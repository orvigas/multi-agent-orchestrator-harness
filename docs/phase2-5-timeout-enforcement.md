# Phase 2.5: Timeout Enforcement (AbortController)

**Status**: ✅ Complete
**Files created**: `src/services/llmTimeout.test.ts`
**Files modified**: `src/services/llm.ts`, `src/services/providerFallback.ts`, `package.json`

## What this closes

Phases 2.3/2.4 introduced `PROVIDER_TIMEOUTS_MS` and `getTimeoutForProvider()`, but the
value was passed into `callProvider` as `_timeoutMs` and **never used**. A provider that
accepted the TCP connection and then hung would block the whole harness indefinitely: the
retry loop, the fallback chain and the circuit breaker were all downstream of an `await`
that never settled.

Phase 2.5 makes the timeout real.

## Implementation

### 1. AbortController in `callProvider` (`src/services/llm.ts`)

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  // signal is threaded into both SDKs as a request option
  await client.messages.create({ ... }, { signal: controller.signal });
} catch (error) {
  if (controller.signal.aborted) {
    throw new LLMTimeoutError(provider, model, timeoutMs);
  }
  throw error;
} finally {
  clearTimeout(timer);          // ← critical, see below
}
```

Two details that matter:

- **`clearTimeout` in `finally`.** Without it, a call that succeeds in 200ms still leaves a
  60s timer armed. Node keeps the event loop alive for pending timers, so `npm run dev`
  would hang for up to a minute after finishing its work. There is a regression test for
  this (it counts `process.getActiveResourcesInfo()` timers before/after).
- **The abort is translated, not leaked.** The SDKs raise `APIUserAbortError` on abort,
  which reads like a client-side cancellation. Checking `controller.signal.aborted` lets us
  report a precise `LLMTimeoutError` carrying provider/model/budget.

### 2. `LLMTimeoutError` + `isTimeoutError` (`src/services/providerFallback.ts`)

`isTimeoutError` sits next to `isRateLimitError` and recognizes:

| Source | Signal |
|---|---|
| Our own abort | `instanceof LLMTimeoutError` |
| Anthropic / OpenAI SDK abort | `name === "APIUserAbortError"` |
| `AbortSignal` / DOMException | `name === "AbortError"` |
| Socket-level timeouts | `code === "ETIMEDOUT" \| "ESOCKETTIMEDOUT"` |
| Text fallback | message contains `timed out` / `timeout` / `request was aborted` |

### 3. Timeouts are retryable in the fallback loop

The retry loop now classifies each failure into three buckets:

```
rate_limited → transient → retry same provider once (backoff), then fall back
timeout      → transient → retry same provider once (backoff), then fall back
error        → permanent → fall back immediately (auth, bad request, …)
```

Every failure — including timeouts — records against the provider's circuit breaker, so a
provider that consistently hangs opens its circuit and is skipped entirely (Phase 2.4).

### 4. Attempt observability

`ProviderAttempt` gained `status: "timeout"` and `durationMs`, so the fallback chain log
shows where the wall-clock time actually went:

```
❌ [0] anthropic/claude-opus-5: rate_limited (312ms)
⏱️ [1] anthropic/claude-opus-5: timeout (30001ms)
✅ [2] openai/gpt-4-turbo: success (1840ms)
```

## Bug found and fixed along the way

`callProvider`'s OpenAI branch passed the system prompt as a top-level `system:` field.
That field does not exist on the OpenAI chat-completions API — the system prompt was
being dropped, so the fallback to OpenAI would have run every role with **no system
prompt at all**. It now goes in as the first message:

```ts
messages: [
  { role: "system", content: request.systemPrompt },
  { role: "user", content: request.userPrompt },
]
```

## Tests (`src/services/llmTimeout.test.ts`, 8 tests)

Following the repo's "invoke the real tool" philosophy, the central test starts a **real
HTTP server that accepts the request and never answers**, points the Anthropic SDK at it
via `ANTHROPIC_BASE_URL`, and asserts that `callProvider` rejects with `LLMTimeoutError`
after — and not before — the budget elapses. Measured: 410ms against a 400ms budget.

| Test | What it proves |
|---|---|
| recognizes `LLMTimeoutError` | error carries provider/model/timeoutMs |
| recognizes SDK abort errors | `APIUserAbortError` / `AbortError` classified |
| recognizes socket timeout codes | `ETIMEDOUT` / `ESOCKETTIMEDOUT` classified |
| returns false for unrelated errors | auth errors are not retried as timeouts |
| rate limit ≠ timeout | the two classifiers don't both claim a 429 |
| unsupported provider | rejects before opening a connection |
| **real hanging server** | abort fires, `LLMTimeoutError` raised, timing respected |
| timer cleanup | no `Timeout` handle left behind |

## Repo hygiene fixed in the same pass

`npx eslint .` had been failing since Phase 2.2 (21 errors: unused imports/vars, `any`).
CI (`.github/workflows/ci.yml`) runs eslint, so it was red. All fixed; `npm run typecheck`
and `npx eslint .` are both clean now. Two of those fixes were real latent bugs rather
than style:

- `planning.ts` parsed the LLM's plan JSON as `any`, so a task without an `id` propagated
  `undefined` into `Plan.order` and the dependency map. Now typed as `Partial<PlanTask>`
  with explicit defaults (`task-${i+1}`, `"(sin descripción)"`).
- `graph.ts` exported `orchestrator: any`; now `ReturnType<typeof builder.compile> | null`.

## Known limitations

1. **The timeout covers the whole request, not time-to-first-token.** With streaming a
   long-but-healthy generation could be aborted. Streaming isn't used yet; when it is, the
   budget should be applied to inter-chunk silence instead.
2. **Timeouts are fixed per provider**, not per role. A `discovery` call with a large
   evidence package legitimately takes longer than a `strategy_decision` call, but both
   get Anthropic's 30s.
3. **No adaptive tuning.** The circuit breaker records timeouts but nothing feeds observed
   latency back into the budgets (candidate for a later phase).
