# Phase 3: Token Budget Enforcement

**Status**: ✅ Complete  
**Files created**: `src/services/tokenBudgetEnforcer.ts`, `src/services/tokenBudgetEnforcer.test.ts`  
**Files modified**: `package.json`  

## Overview

Phase 1.3 introduced **token tracking** (measuring actual tokens used). Phase 2 added **LLM integration** (real API calls). Phase 3 adds **budget enforcement**: if a run exceeds its token or cost budget, it escalates — preventing runaway expenses and enabling better cost control.

## The Problem

Without enforcement:
- A poorly-scoped discovery call uses 100K tokens without warning
- Multiple retries across providers multiply costs unexpectedly
- No mechanism to stop before hitting a hard limit
- Only post-hoc audit logs reveal overspend

With enforcement:
- Continuous monitoring against configured budgets
- Early escalation when limits are exceeded
- Operationalized cost control

## Solution

### 1. Budget configuration

Already exists in `config/orchestrator.yml`:

```yaml
orchestrator:
  tokenBudget:
    limit: 200000       # 200K tokens per run
  costBudget:
    limitUsd: 5         # $5.00 USD per run
```

These are real limits that will be enforced starting Phase 3.

### 2. Core functions

#### `calculateTokenUsage(events: TokenUsageEvent[])`

Sums actual tokens from all LLM calls in the run:

```ts
const { totalTokens, totalCostUsd } = calculateTokenUsage(state.tokenEvents);
// totalTokens: sum of all input+output tokens
// totalCostUsd: estimated cost using provider pricing
```

Cost estimation (Claude 3.x approximate pricing):
- Input: $0.003 per 1K tokens
- Output: $0.009 per 1K tokens

#### `enforceTokenBudget(events, tokenBudget, costBudget): BudgetEnforcementResult`

Checks cumulative usage against limits:

```ts
const result = enforceTokenBudget(
  state.tokenEvents,
  { limit: 200_000 },
  { limitUsd: 5.0 }
);

// Returns:
{
  isWithinTokenBudget: true,      // totalTokens <= limit
  isWithinCostBudget: true,       // totalCostUsd <= limitUsd
  tokensUsed: 45_000,
  tokensRemaining: 155_000,
  costUsedUsd: 0.35,
  costRemainingUsd: 4.65,
  exceedanceReason: undefined     // "tokens_exceeded" | "cost_exceeded" if over
}
```

#### `formatBudgetStatus(result)`

Human-readable output for logs:

```
Token Budget: ✅ 45000 / 200000 (22.5%)
Cost Budget: ✅ $0.350 / $5.000 (7.0%)
```

or

```
Token Budget: ❌ 210000 / 200000 (105.0%)
Cost Budget: ✅ $3.200 / $5.000 (64.0%)
⚠️  Exceeded: tokens_exceeded
```

### 3. Integration into orchestrator loop

Phase 3 is infrastructure; Phase 3.5+ will wire it into the orchestrator's routing:

```ts
// After each LLM call updates state.tokenEvents:
const budgetStatus = enforceTokenBudget(
  state.tokenEvents,
  orchestratorConfig.tokenBudget,
  orchestratorConfig.costBudget
);

if (!budgetStatus.isWithinTokenBudget || !budgetStatus.isWithinCostBudget) {
  // Escalate: set failureCategory = "budget_exceeded"
  // Recovery loop decides: retry with cheaper model? Abort?
  state.failureCategory = "budget_exceeded";
  state.failureDetail = budgetStatus.exceedanceReason;
}
```

## Real-world scenario

### Run exceeds token budget mid-discovery

```
T+0ms    Start run: budget 200K tokens
T+5000ms Discovery call: +50K tokens (150K remaining)
T+8000ms Planner call: +60K tokens (90K remaining)
T+12000ms Evidence retrieval (Retry#1): +45K tokens (45K remaining)
T+15000ms Evidence retrieval (Retry#2): +30K tokens
         ↓ BUDGET EXCEEDED (210K total)
T+15500ms Recovery loop notified: "tokens_exceeded"
         Strategy: downgrade planner to cheaper model OR abort
```

With enforcement, the harness knows at T+15500ms and can make an intelligent decision. Without it, the run completes, cost bill arrives, and operators wonder why they exceeded budget.

## Tests (`src/services/tokenBudgetEnforcer.test.ts`, 8 tests)

| Test | What it verifies |
|---|---|
| Sum tokens from events | Multiple calls accumulate correctly |
| Within budget | No exceedance when under limits |
| Token exceeded | Detects and reports when tokens > limit |
| Cost exceeded | Detects and reports when USD > limit |
| Both exceeded | Prefers token exceedance in reason |
| Format status (OK) | Readable output with checkmarks |
| Format status (WARN) | Readable output with warning icon |
| Empty events | Zero usage is within budget |

## Cost model

Pricing used for estimates (can be updated in Phase 3.x):

| Provider | Model | Input (/1K) | Output (/1K) |
|---|---|---|---|
| Anthropic | Claude 3 | $0.003 | $0.009 |
| OpenAI | GPT-4 | $0.015 | $0.030 |
| OpenRouter | Various | ~$0.005–0.030 | ~$0.015–0.090 |

Current implementation uses Anthropic pricing for all; Phase 3.x can extend to per-provider pricing.

## Integration with earlier phases

### Phase 1.3 (Token Tracking)

- Source of truth: `state.tokenEvents` array
- Token Budget Enforcer reads this array
- No changes needed to Phase 1.3

### Phase 2 (LLM Integration)

- Each `callLLM` call populates `state.tokenEvents`
- Token Enforcer checks totals after each population
- No changes needed to Phase 2

## Known limitations

1. **Estimates, not actuals, for cost.** OpenAI/OpenRouter pricing is not real; Phase 3.5 can integrate real pricing from provider APIs.
2. **No per-provider pricing yet.** All providers use Anthropic pricing; Phase 3.x can add provider-specific pricing.
3. **Linear calculation only.** No special logic for volume discounts or tiered pricing.
4. **No budget adjustment.** Limits are static; Phase 3.x can add per-ticket budgets or adaptive limits based on ticket complexity.

## Future improvements

1. **Per-ticket budgets.** `config/tickets.yml` specifies budget for each issue (small fix: 10K tokens, large refactor: 100K tokens).
2. **Real cost integration.** Hook into provider APIs to get actual costs instead of estimates.
3. **Intelligent escalation.** When budget exceeded, Recovery loop automatically downgrades models (Opus→Sonnet→Haiku) before aborting.
4. **Budget analytics.** Track cost per layer, per role, per ticket type for capacity planning.
5. **Cost forecasting.** Warn when a run is on pace to exceed budget before it actually does.
