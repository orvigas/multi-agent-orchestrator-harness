# Phase 2.6: Adaptive Backoff Learning

**Status**: ✅ Complete  
**Files created**: `src/services/adaptiveBackoff.test.ts`  
**Files modified**: `src/services/providerFallback.ts`, `src/services/llm.ts`, `package.json`  

## Overview

Phases 2.3–2.5 built a retry loop with exponential backoff (100ms → 200ms → 400ms…), assuming all transient failures are created equal. Phase 2.6 learns from the circuit breaker's failure history: **if a provider is accumulating failures, multiply the backoff to give it more time to recover instead of hammering it while it's still stressed.**

## What this closes

Without adaptive backoff, a provider under stress (rate limited, timing out) gets retried according to a fixed schedule. If it's genuinely recovering but slowly, the standard exponential backoff doesn't account for that — we might retry during a window when the service is still overloaded, fail again, and escalate the circuit breaker's consecutive-failure count unnecessarily.

By feeding the circuit breaker's consecutive-failure counter back into the backoff calculation, we shift from blind retry to **observed-aware retry**: "If you've already failed N times, wait longer before trying again."

## Implementation

### 1. Adaptive multiplier function (`src/services/providerFallback.ts`)

```ts
export function calculateAdaptiveBackoffMultiplier(consecutiveFailures: number): number {
  if (consecutiveFailures <= 1) return 1.0;      // Healthy: normal backoff
  if (consecutiveFailures <= 3) return 1.5;      // Stressed: 50% longer
  return 2.5;                                    // Critical: 2.5x longer
}
```

| Consecutive Failures | Multiplier | Rationale |
|---|---|---|
| 0–1 | 1.0× | Provider is generally healthy; standard backoff is appropriate |
| 2–3 | 1.5× | Provider under stress; give it extra breathing room |
| 4+ | 2.5× | Approaching circuit breach (threshold: 5); wait longest to let service stabilize |

### 2. Integration into retry loop (`src/services/llm.ts`)

After a transient failure (rate limit or timeout) triggers a retry:

```ts
const baseBackoffMs = calculateBackoffDelay(attemptNum);  // 100ms exponential + jitter
const metrics = circuitBreaker.getProviderMetrics(providerName, model);
const adaptiveMultiplier = metrics
  ? calculateAdaptiveBackoffMultiplier(metrics.consecutiveFailures)
  : 1.0;
const backoffMs = baseBackoffMs * adaptiveMultiplier;

console.warn(
  `Rate limited on ${providerName}/${model}. Waiting ${Math.round(backoffMs)}ms before retry (adaptive: ${adaptiveMultiplier.toFixed(1)}x)...`
);
await sleep(backoffMs);
```

### Real-world scenario

```
Time  Failure                                   Consecutive  Multiplier  Backoff
----  -----                                     -----------  ----------  --------
T+0   Anthropic rate limit (1st)               1            1.0x        100ms
T+100 Anthropic rate limit (2nd)               2            1.5x        150ms  ← now longer
T+250 Anthropic rate limit (3rd)               3            1.5x        150ms
T+400 Anthropic rate limit (4th)               4            2.5x        250ms  ← even longer
T+650 Anthropic rate limit (5th) → circuit OPEN
T+655 Fallback to OpenAI (succeeds)
```

Without adaptive backoff, each retry used 100ms, potentially hitting the service during recovery. With adaptive backoff, the 4th failure gets 250ms — almost 3x longer — giving Anthropic's backend more time to shed load.

## Tests (`src/services/adaptiveBackoff.test.ts`, 9 tests)

| Test | What it verifies |
|---|---|
| Healthy provider | 0 failures → 1.0x multiplier |
| One failure | Still 1.0x (give it one chance before backing off) |
| Two failures | 1.5x (elevated stress) |
| Three failures | 1.5x (still stressed, not yet critical) |
| Four failures | 2.5x (critical, approaching circuit breach) |
| Five failures | 2.5x (at circuit threshold, wait longest) |
| Many failures | 2.5x (caps at maximum) |
| Multiplier applied to delay | 100ms × 2.5 = 250ms (sanity check) |
| Monotonic progression | Multiplier never decreases as failures grow |

## Observability

Retry logs now show the adaptive multiplier:

```
Rate limited on anthropic/claude-opus-5. Waiting 250ms before retry (adaptive: 2.5x)...
```

This makes it visible in logs when adaptive backoff is active and by how much.

## Integration with existing phases

### Circuit Breaker (Phase 2.4)

- Provides `getProviderMetrics()` → returns `consecutiveFailures` count
- Adaptive backoff reads this count; circuit breaker doesn't change
- No circular dependency: circuit breaker updates on every failure, adaptive backoff reads during retry

### Timeout Enforcement (Phase 2.5)

- Timeouts populate `consecutiveFailures` counter, same as rate limits
- Both trigger adaptive backoff: if a provider times out repeatedly, we wait longer

### Retry Loop (Phase 2.3)

- Backoff is applied only to transient failures (rate limit + timeout)
- Permanent errors (auth) still fall back immediately

## Known edge cases

1. **First failure across multiple processes.** Circuit breaker metrics are in-memory per process. If requests are load-balanced across multiple harness instances, each process sees only its own failure count. Adaptive backoff is per-process; a fully distributed circuit breaker (Redis/Postgres) would improve this (future phase).

2. **Recovery lag.** If a provider recovers between failure #4 and the retry, adaptive backoff adds unnecessary delay. This is conservative — better to wait longer than to hammer a recovering service. HALF_OPEN state (Phase 2.4) handles the long-term recovery path.

3. **Cascading multipliers.** If the same provider fails across multiple concurrent roles, each failure increments the counter, and all waiting requests see the higher multiplier. Multiplier only reflects failure history, not concurrency, so this is intentional (more failures → more backoff, regardless of source).

## Future improvements

1. **Per-role budgets.** Different roles have different typical durations (discovery with large evidence packages vs. strategy_decision). Separate timeout/backoff budgets per role.

2. **Machine learning integration.** Feed consecutive-failure counts and observed latencies into a simple learner (Kalman filter, exponential moving average) to predict the optimal backoff for each provider/model/time-of-day combination.

3. **Distributed state.** Move circuit breaker metrics to Redis/PostgreSQL so adaptive backoff works correctly across multiple harness instances.

4. **Jitter tuning.** Current jitter is ±10%. Under high stress, wider jitter (±20%–30%) reduces thundering herd if multiple concurrent requests all retry simultaneously.
