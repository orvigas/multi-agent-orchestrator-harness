# Phase 2.3: Retry Implementation with Provider Fallback

**Status**: ✅ Complete
**Implementation Date**: 2026-07-30

## Overview

Phase 2.3 implements actual retry logic with exponential backoff and provider fallback. The system now:
- Detects rate limits and retries with backoff
- Falls back to alternative providers on consecutive failures
- Tracks all attempts for observability
- Supports Anthropic and OpenAI (fallback ready for OpenRouter)
- Has provider-specific timeouts

## Architecture

### Retry Loop

```
For each provider in fallback chain:
  For each retry attempt (maxAttemptsPerProvider):
    1. Try provider
    2. On rate limit: calculate backoff → sleep → retry same provider
    3. On other error: break to next provider
    4. On success: return response + attempt history
  
On all providers exhausted: throw error with attempt history
```

### Rate Limit Handling

When rate limit detected (429, rate_limit_exceeded, overloaded):

1. **Calculate backoff**: `100ms * 2^attemptNumber` + jitter
2. **Sleep**: async wait for backoff duration
3. **Retry**: attempt same provider again
4. **If still failing**: move to next provider

**Example**:
```
Attempt 0: Anthropic (rate limited)
Wait: 100ms (+ ±10% jitter)
Attempt 1: Anthropic (rate limited again)
→ Switch to OpenAI
Attempt 2: OpenAI (success!)
```

### Provider Abstraction

New `callProvider` function handles multiple LLM providers:

```typescript
async function callProvider(
  provider: string,        // "anthropic", "openai"
  model: string,           // "claude-opus-5", "gpt-4-turbo"
  request: LLMRequest,
  apiKey: string,
  _timeoutMs: number       // Reserved for Phase 2.4
): Promise<LLMResponse>
```

**Supports**:
- Anthropic: Uses Claude API
- OpenAI: Uses OpenAI API (via openai SDK)
- OpenRouter: Fallback (when implemented)

**Returns**: Unified `LLMResponse` format across all providers.

### Provider-Specific Timeouts

Different providers have different characteristics:

```typescript
const PROVIDER_TIMEOUTS_MS: Record<string, number> = {
  anthropic: 30_000,   // 30s (Anthropic can be slower)
  openai: 20_000,      // 20s (OpenAI is typically fast)
  openrouter: 60_000,  // 60s (proxy routing, extra buffer)
};
```

**Note**: Timeouts are calculated but not yet enforced (Phase 2.4 feature). The infrastructure is ready.

### Attempt Tracking

Each LLMResponse now includes attempt history:

```typescript
interface LLMResponse {
  // ... existing fields
  attempts?: ProviderAttempt[];  // Phase 2.3
}

interface ProviderAttempt {
  provider: string;
  model: string;
  status: "success" | "rate_limited" | "unavailable" | "error";
  error?: string;
  tokensUsed?: number;
}
```

**Example**:
```json
{
  "content": "Generated patch...",
  "provider": "openai",
  "attempts": [
    {
      "provider": "anthropic",
      "model": "claude-opus-5",
      "status": "rate_limited",
      "error": "429: Too Many Requests"
    },
    {
      "provider": "anthropic",
      "model": "claude-opus-5",
      "status": "rate_limited",
      "error": "429: Too Many Requests"
    },
    {
      "provider": "openai",
      "model": "gpt-4-turbo",
      "status": "success",
      "tokensUsed": 3500
    }
  ]
}
```

## Implementation Details

### callLLM with Retry (Phase 2.3)

```typescript
export async function callLLM(
  request: LLMRequest,
  config: OrchestratorConfig
): Promise<LLMResponse> {
  // 1. Get provider fallback chain
  const providers = getFallbackProviders(request.role, config);
  const attempts: ProviderAttempt[] = [];

  // 2. Try each provider
  for (const { provider, model } of providers) {
    const maxAttemptsPerProvider = 2;

    // 3. Retry loop per provider
    for (let attemptNum = 0; attemptNum < maxAttemptsPerProvider; attemptNum++) {
      try {
        // 4. Call provider
        const response = await callProvider(
          provider,
          model,
          request,
          apiKey,
          getTimeoutForProvider(provider)
        );

        // Success!
        return { ...response, attempts };
      } catch (error) {
        // 5. Handle error
        if (isRateLimitError(error)) {
          // Rate limited: retry same provider
          const backoffMs = calculateBackoffDelay(attemptNum);
          await sleep(backoffMs);
        } else {
          // Other error: move to next provider
          break;
        }
      }
    }
  }

  // All failed
  throw new Error("All providers exhausted");
}
```

## Observability

### Attempt Tracking in Logs

When a provider is retried:

```
Rate limited on anthropic/claude-opus-5. Waiting 100ms before retry...
Rate limited on anthropic/claude-opus-5. Waiting 200ms before retry...
All providers exhausted for role: implementer
Provider Selection: none (all_failed)
Fallback chain:
  ❌ [0] anthropic/claude-opus-5: rate_limited
      Error: 429: Too Many Requests
  ❌ [1] anthropic/claude-opus-5: rate_limited
      Error: 429: Too Many Requests
  ❌ [2] openai/gpt-4-turbo: error
      Error: Unauthorized
```

### Token Tracking with Attempt Info

Nodes can log which provider was used:

```typescript
const event = recordTokenUsage(
  "implementation",
  "patch_generation",
  "Patch generated after provider fallback",
  taskId,
  {
    provider: response.provider,  // "openai"
    model: response.model,        // "gpt-4-turbo"
    attempts: response.attempts?.length,  // 3 attempts
    finalProvider: response.provider,
    tokenUsed: response.totalTokens,
  }
);
```

## Testing

10 new tests in `src/services/llm.retry.test.ts` covering:

- Timeout configuration per provider
- Sleep/backoff calculation
- Provider abstraction for Anthropic/OpenAI
- Retry loop on rate limit
- Fallback to next provider on failure
- Attempt history tracking
- Formatted output for debugging
- Circuit breaker pattern (Phase 2.4 blueprint)

All 185 tests pass.

## Known Limitations

### Phase 2.3 (Current)

1. **No timeout enforcement** — Timeouts are configured but not used
   - Reason: Deferred to Phase 2.4 with AbortController
   - Code ready but not wired: `_timeoutMs` parameter reserved

2. **OpenRouter not implemented** — Fallback chain references it but not supported
   - Reason: Simplify initial implementation
   - Phase 2.4: Add OpenRouter support (uses same API as OpenAI)

3. **No circuit breaker** — Doesn't disable consistently failing providers
   - Reason: Simple retry loop first, state management later
   - Phase 2.4: Track failure rate per provider, skip if > threshold

4. **Retry count fixed at 2** — No config option
   - Reason: Good default (one retry on rate limit)
   - Phase 2.4: Make configurable per provider/role

### Phase 2.4 (Planned)

1. **Timeout enforcement** — Actually interrupt requests after timeout
   - Using AbortController per provider timeout

2. **Circuit breaker** — Track consecutive failures, skip bad providers

3. **Metrics** — Detailed retry statistics
   - Rate limit frequency per provider
   - Fallback chain effectiveness
   - Time spent retrying

4. **Adaptive backoff** — Learn from provider patterns
   - Anthropic rate limits: longer backoff
   - OpenAI quick recovery: shorter backoff

## Production Readiness Checklist

✅ Rate limit detection (Anthropic, OpenAI, HTTP 429)
✅ Backoff calculation (exponential + jitter)
✅ Provider abstraction (unified interface)
✅ Fallback chain (anthropic → openai → openrouter)
✅ Attempt tracking (for observability)
✅ Logging (detailed retry chain output)
✅ Phase 1.3 integration (provider metadata in token events)
⏳ Timeout enforcement (Phase 2.4)
⏳ Circuit breaker (Phase 2.4)
⏳ Metrics (Phase 2.4)

## Configuration for Production

### Declare provider variants

```yaml
# config/planner.yml
roles:
  discovery:
    provider: anthropic
    model: claude-opus-5
  discovery_openai:
    provider: openai
    model: gpt-4-turbo
  discovery_openrouter:
    provider: openrouter
    model: openrouter/openai/gpt-4
```

### Set API keys

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export OPENROUTER_API_KEY=sk-or-...
export HARNESS_MODE=llm
```

### Monitor retry usage

```bash
# Real-time retry events
npm run dev 2>&1 | grep "Rate limited"

# Count fallback activations
npm run dev 2>&1 | grep "All providers exhausted" | wc -l
```

## Example: Real-World Scenario

**Scenario**: Anthropic hitting rate limits during peak usage.

```
13:42:15 - Phase: planner/discovery
13:42:15 - Request: "Analyze this ticket and evidence"
13:42:15 - Attempt [0] anthropic/claude-opus-5
13:42:16 - ERROR: 429: Rate limit reached
13:42:16 - Rate limited. Waiting 103ms before retry...
13:42:16 - Attempt [1] anthropic/claude-opus-5 (retry)
13:42:17 - ERROR: 429: Rate limit reached
13:42:17 - Fallback to next provider...
13:42:17 - Attempt [2] openai/gpt-4-turbo
13:42:18 - SUCCESS: Generated discovery output
13:42:18 - Used 2,100 tokens on openai/gpt-4-turbo
13:42:18 - Attempt history: anthropic[2x rate-limited] → openai[success]
```

**What happened**:
1. Rate limit hit on Anthropic
2. Retried after 103ms backoff (exponential)
3. Still rate limited
4. Switched to OpenAI
5. Success on first OpenAI attempt
6. Returned response with full attempt history

**Cost**: Slightly higher (OpenAI instead of Anthropic), but completed successfully.

## References

- **src/services/llm.ts** — Main callLLM with retry implementation
- **src/services/llm.retry.test.ts** — 10 retry logic tests
- **src/services/providerFallback.ts** — Fallback utilities (Phase 2.2)
- **config/planner.yml** — Example role variants
- **Phase 2.2** — Multi-provider fallback infrastructure
- **Phase 2.4** — Planned timeout enforcement + circuit breaker
