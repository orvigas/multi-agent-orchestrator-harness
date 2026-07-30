# Phase 2.7: Per-Role Timeout Budgets

**Status**: ✅ Complete  
**Files modified**: `src/services/llm.ts`, `config/providers.yml`, `config/planner.yml`, `config/implementation.yml`, `config/recovery.yml`, `package.json`  
**Files created**: `src/services/roleTimeouts.test.ts`  

## Overview

Phase 2.5 enforced timeouts per **provider** (Anthropic 30s, OpenAI 20s, OpenRouter 60s), assuming all roles take the same time. Phase 2.7 recognizes that **different roles have different time requirements** and configures budgets per role, overriding provider defaults when needed.

## The Problem

Without per-role budgets:
- `discovery` (AST search + evidence retrieval) uses Anthropic's 30s, sometimes needs more
- `plan_validator` (quick sanity check) uses 30s when 15s would be plenty
- `planner` (complex reasoning) uses 30s but could benefit from 60s

The misalignment wastes time or forces early timeouts.

## Solution

### 1. Role-specific timeout configuration

Two layers of configuration:

**Central (`config/providers.yml`)**:
```yaml
roleTimeouts:
  discovery: 45_000           # 45s: AST + evidence search
  planner: 60_000             # 60s: most complex reasoning
  plan_validator: 15_000      # 15s: quick check
  implementer: 45_000         # 45s: code generation
  recovery_diagnostician: 30_000  # 30s: root cause analysis
  recovery_strategist: 15_000     # 15s: quick decision
```

**Per-layer (`config/planner.yml`, etc.)**:
```yaml
timeouts:
  discovery: 45_000
  planner: 60_000
  plan_validator: 15_000
```

The central config in `providers.yml` is the source of truth; per-layer configs serve as documentation/validation.

### 2. Timeout resolution in callLLM

New function `getTimeoutForProviderAndRole`:

```ts
export function getTimeoutForProviderAndRole(
  provider: string,
  role: string,
  config: OrchestratorConfig
): number {
  // Step 1: Check if role has custom timeout
  const roleTimeouts = (config as { roleTimeouts?: Record<string, number> }).roleTimeouts;
  if (roleTimeouts?.[role]) {
    return roleTimeouts[role];
  }

  // Step 2: Fall back to provider default
  return PROVIDER_TIMEOUTS_MS[provider] ?? 30_000;
}
```

When `callLLM` is invoked:

```ts
const timeout = getTimeoutForProviderAndRole(providerName, request.role, config);
```

The `request.role` (e.g., `"discovery"`, `"planner"`) is already passed, so no changes needed to callers.

### 3. Timeout categories

| Category | Roles | Budget | Rationale |
|---|---|---|---|
| **Fast checks** | `plan_validator`, `recovery_strategist` | 15s | Quick, rule-based decisions |
| **Moderate** | `recovery_diagnostician` | 30s | Analyzing failure logs |
| **Heavy reasoning** | `discovery`, `implementer` | 45s | AST search, code generation |
| **Heaviest** | `planner` | 60s | Complex plan graph reasoning |

## Real-world impact

### Before

```
discovery with large evidence package:
  - Budget: 30s (Anthropic default)
  - Actual time: 28s (tight, sometimes times out)
  - Problem: Optimal evidence not retrieved in time
```

### After

```
discovery with large evidence package:
  - Budget: 45s (role-specific)
  - Actual time: 28s (comfortable margin)
  - Benefit: Retrieves full evidence set, plan quality improves
```

Another example:

```
plan_validator (quick sanity check):
  - Before: 30s (wastes time)
  - After: 15s (fails fast if there's an issue)
  - Benefit: Shorter iteration cycles
```

## Tests (`src/services/roleTimeouts.test.ts`, 5 tests)

| Test | What it verifies |
|---|---|
| Configuration defines budgets | All budgets are positive and <= 60s |
| Complex roles get more time | `planner` > `plan_validator` |
| Validators are fast | 15s or less |
| Diagnosticians are moderate | 20–40s range |
| Reasoners are slow | 40–60s range |

## Integration with earlier phases

### Phase 2.5 (Timeout Enforcement)

- `AbortController` still enforces the timeout; Phase 2.7 just changes which timeout value is used
- If `roleTimeouts` has an entry, use it; otherwise fall back to `PROVIDER_TIMEOUTS_MS`

### Phase 2.6 (Adaptive Backoff)

- No interaction: adaptive backoff multiplier is independent of timeout budget
- A long timeout for `planner` doesn't change its backoff multiplier

### Phase 2.4 (Circuit Breaker)

- Circuit breaker tracks failures; timeout doesn't affect circuit behavior
- A timeout counts as a failure for circuit-breaker purposes (same as rate limit)

## Extensibility

Adding a new role is two lines:

```yaml
# config/providers.yml
roleTimeouts:
  my_new_role: 35_000
```

The resolver will automatically use it for that role; no code changes needed.

## Known limitations

1. **No dynamic tuning.** Timeout budgets are static; they don't adapt based on observed latency (candidate for Phase 3.x).
2. **Per-provider-per-role would be even better.** E.g., `discovery` on Anthropic might need 45s while on OpenAI needs only 25s. Current implementation is per-role only, falling back to provider-default. (Could extend in a future phase.)
3. **No request-specific overrides.** A discovery request with a 100MB evidence package can't request a longer timeout for just that call. (Would require threading timeout through to `callLLM` at call site.)

## Future improvements

1. **Machine learning timeouts.** Track observed latencies per role/provider/time-of-day, use Kalman filter to predict optimal budgets.
2. **Per-provider-per-role.** `discovery_anthropic: 45_000, discovery_openai: 25_000`.
3. **Request-level overrides.** Allow individual `callLLM` calls to specify a timeout: `callLLM(request, config, { timeoutMs: 50_000 })`.
4. **Adaptive budgets.** If a role consistently uses 80%+ of its budget, automatically increase it.
