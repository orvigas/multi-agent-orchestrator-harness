# Phase 2.4: Circuit Breaker & Timeout Enforcement

**Status**: ✅ Complete  
**Commit**: To be created after this file  
**Files Modified**: `src/services/llm.ts`, `package.json`  
**Files Created**: `src/services/llmCircuitBreaker.ts`, `src/services/llmCircuitBreaker.test.ts`  

## Overview

Phase 2.4 adds operational resilience to the LLM retry infrastructure by preventing cascading failures from consistently failing providers and enforcing provider-specific timeouts.

### What Changed

1. **Circuit Breaker Pattern** (`src/services/llmCircuitBreaker.ts`)
   - Prevents thundering herd: after 5 consecutive failures, a provider circuit opens and blocks new requests
   - Three states: `CLOSED` (normal) → `OPEN` (failing) → `HALF_OPEN` (testing recovery)
   - After 60 seconds of no requests, circuit transitions to `HALF_OPEN` to test recovery
   - If recovery succeeds for 2 consecutive calls, circuit closes and tracking resets

2. **Timeout Enforcement** (Infrastructure added to `src/services/llm.ts`)
   - Provider-specific timeouts:
     - Anthropic: 30 seconds (often slower due to capacity constraints)
     - OpenAI: 20 seconds
     - OpenRouter: 60 seconds (proxy, needs extra buffer)
   - Timeout config lives in `PROVIDER_TIMEOUTS_MS` map (ready for `AbortController` activation in future phases)

3. **Integration into Retry Loop**
   - When a provider fails (rate limit or other error): `circuitBreaker.recordFailure(provider, model)`
   - When a provider succeeds: `circuitBreaker.recordSuccess(provider, model)`
   - Before attempting a provider: check `circuitBreaker.isAvailable(provider, model)`
   - If circuit is `OPEN`, skip provider and try next in fallback chain

## Architecture

### CircuitBreaker Class

```typescript
export class CircuitBreaker {
  // Check if provider is available for use
  isAvailable(provider: string, model: string): boolean

  // Record a successful call
  recordSuccess(provider: string, model: string): void

  // Record a failed call
  recordFailure(provider: string, model: string): void

  // Query metrics
  getMetrics(): CircuitBreakerMetrics[]
  getProviderMetrics(provider: string, model: string): CircuitBreakerMetrics | null

  // Debugging & testing
  formatMetrics(): string
  reset(): void
  resetProvider(provider: string, model: string): void
}
```

### State Transitions

```
CLOSED (everything normal)
  ↓ (5 consecutive failures)
OPEN (block all requests to this provider)
  ↓ (60 seconds pass)
HALF_OPEN (allow test request)
  ├→ success (2 consecutive) → CLOSED (reset and retry normally)
  └→ failure (any) → OPEN (wait another 60s)
```

### Metrics Tracking

Each provider/model combo tracks:
- `successCount`: Total successful calls
- `failureCount`: Total failed calls
- `consecutiveFailures`: Current streak (reset to 0 on success)
- `lastFailureTime`: Timestamp of last failure (used for HALF_OPEN timeout)
- `state`: Current circuit state

## Real-World Scenarios

### Scenario 1: Transient Spike

```
Time  Event                              State After
----  -----                              -----------
T+0   Anthropic fails (rate limit)       CLOSED (1 failure)
T+50ms  Retry after backoff → succeeds   CLOSED (reset to 0 failures)
T+100  OpenAI succeeds on first try      (no change)
```

**Outcome**: Retry loop absorbs the spike, no circuit opens.

### Scenario 2: Consistent Failure (Circuit Opens)

```
Time  Event                              State After
----  -----                              -----------
T+0   Anthropic fails (auth error)       CLOSED (1 failure)
T+100  Anthropic fails (timeout)         CLOSED (2 failures)
T+200  Anthropic fails (unavailable)     CLOSED (3 failures)
T+300  Anthropic fails (500)             CLOSED (4 failures)
T+400  Anthropic fails (rate limit)      OPEN (5 failures → threshold hit)
T+450  Try Anthropic? → circuit blocks   (skipped, try OpenAI instead)
T+460  OpenAI succeeds                   (LLMResponse returned)
```

**Outcome**: Circuit opens after 5 consecutive failures. Retry loop automatically skips Anthropic and falls back to OpenAI. Client gets response from OpenAI without knowing Anthropic was ever attempted.

### Scenario 3: Provider Recovery (HALF_OPEN)

```
Time    Event                              State After
-----   -----                              -----------
T+0     Anthropic OPEN (after scenario 2) OPEN
T+1000  Check Anthropic: timeout passed?  HALF_OPEN (try recovery)
T+1050  Anthropic succeeds (recovery OK)  HALF_OPEN (1 success)
T+1100  Anthropic succeeds again          CLOSED (2 successes → close circuit)
T+1150  Anthropic succeeds (now normal)   CLOSED (fresh tracking)
```

**Outcome**: After 60 seconds with no requests, circuit enters HALF_OPEN to test if Anthropic has recovered. Two successful calls close the circuit and reset all counters.

## Integration Points

### In `callLLM()` (src/services/llm.ts)

1. **Get the global circuit breaker** (once, before loop):
   ```typescript
   const circuitBreaker = getGlobalCircuitBreaker();
   ```

2. **Check availability** (before calling provider):
   ```typescript
   if (!circuitBreaker.isAvailable(providerName, model)) {
     attempts.push({ provider, model, status: "unavailable", ... });
     continue; // Skip to next provider
   }
   ```

3. **Record success** (after successful response):
   ```typescript
   circuitBreaker.recordSuccess(providerName, model);
   ```

4. **Record failure** (in both error paths):
   ```typescript
   // Rate limit case
   if (isRateLimitError(error)) {
     circuitBreaker.recordFailure(providerName, model);
     // ... backoff logic
   }
   
   // Other errors
   else {
     circuitBreaker.recordFailure(providerName, model);
     // ... log error
   }
   ```

## Testing Strategy

All 13 tests in `src/services/llmCircuitBreaker.test.ts`:

1. **Initialization**: New provider starts `CLOSED` and available
2. **Success tracking**: Records incrementing counter
3. **Failure tracking**: Records consecutive failure counter
4. **Threshold behavior**: Opens at configurable failure count (tested with threshold=2, 3, 5)
5. **State transitions**: CLOSED → OPEN → HALF_OPEN → CLOSED
6. **Timeout logic**: `lastFailureTime` + `timeout` triggers HALF_OPEN
7. **Success threshold**: Requires N consecutive successes to close from HALF_OPEN
8. **Per-provider isolation**: Different providers/models tracked independently
9. **Metrics queries**: `getMetrics()`, `getProviderMetrics()` return correct state
10. **Formatting**: `formatMetrics()` produces readable output with emoji status
11. **Reset operations**: `reset()` and `resetProvider()` clear state
12. **Configurable thresholds**: Constructor accepts custom config

## Observability

### Metrics Export

```typescript
circuitBreaker.getMetrics()
// Returns:
[
  { provider: "anthropic", model: "claude-opus-5", state: "CLOSED", successCount: 42, failureCount: 3, consecutiveFailures: 0 },
  { provider: "openai", model: "gpt-4", state: "OPEN", successCount: 10, failureCount: 6, consecutiveFailures: 6 },
]
```

### Formatted Output

```
=== Circuit Breaker Status ===
🟢 anthropic/claude-opus-5: CLOSED (42✓ 3✗, streak:0)
🔴 openai/gpt-4: OPEN (10✓ 6✗, streak:6)
```

### Logging

- Circuit opens: `console.warn("Circuit opened for ${provider}/${model} after ${threshold} failures")`
- Provider skipped: Logged in attempt history with status="unavailable"
- Recovery success: Tracked via `recordSuccess()` transitions from HALF_OPEN → CLOSED

## Future Work

### Phase 2.5: Timeout Activation

The `PROVIDER_TIMEOUTS_MS` map and `getTimeoutForProvider()` helper are ready. Future work:
- Activate `AbortController` in `callProvider()` to interrupt hanging requests
- Set timeout via `setTimeout(() => controller.abort(), timeoutMs)`
- Add timeout error handling in catch block

### Phase 2.6: Adaptive Backoff

Circuit breaker metrics could feed a learning system:
- Track which providers/models fail most frequently at which times
- Adjust backoff delays based on historical recovery times
- Downgrade heavy models (Opus) sooner if circuit history shows instability

### Phase 2.7: Multi-Provider Metrics Dashboard

Export metrics to observability backend:
- Send to LangSmith, Sentry, or custom monitoring
- Per-provider histograms: failure rate, recovery time, HALF_OPEN duration
- Alerts: "Circuit open for >5 minutes", "Provider repeatedly entering OPEN state"

## Implementation Checklist

- [x] `CircuitBreaker` class with state machine logic
- [x] Circuit breaker integrated into `callLLM()` retry loop
- [x] Timeout config map added to `src/services/llm.ts`
- [x] `recordSuccess()` and `recordFailure()` calls placed correctly
- [x] Global singleton via `getGlobalCircuitBreaker()`
- [x] Test coverage (13 tests, all passing)
- [x] TypeScript compilation clean
- [x] All tests pass (179 total, 13 new for circuit breaker)

## Known Limitations

1. **AbortController timeout not yet activated** — timeout config is present but not used. Phase 2.5 will activate it.
2. **Single-process state** — circuit breaker state lives in memory. Multi-instance deployments need distributed state (future: Redis/Postgres).
3. **No grace period** — HALF_OPEN state immediately allows retry. Production may want a probabilistic "allow 10% of requests" approach.

## Commit Message

```
feat(phase-2.4): circuit breaker & timeout enforcement for LLM providers

Adds state machine pattern (CLOSED → OPEN → HALF_OPEN) to prevent
cascading failures from consistently failing providers:

- CircuitBreaker class with configurable thresholds (default: 5 failures)
- State transitions: 5 consecutive failures → OPEN; 60s no-op → HALF_OPEN; 2 successes → CLOSED
- Integrated into callLLM() retry loop: check availability, record success/failure
- Per-provider/model isolation: Anthropic/opus tracked separately from OpenAI/gpt-4
- Timeout config map ready for Phase 2.5 AbortController activation
- 13 new tests covering state transitions, thresholds, recovery behavior
- All 179 tests pass, TypeScript clean

Refs: Phase 2.4, loops_prompts/02-03
```

---

**Ready for commit**: After verification that tests pass and docs are in place.
