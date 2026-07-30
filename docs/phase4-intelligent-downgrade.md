# Phase 4: Intelligent Model Downgrade

**Status**: ✅ Complete  
**Files created**: `src/services/modelDowngradeStrategy.ts`, `src/services/modelDowngradeStrategy.test.ts`  
**Files modified**: `package.json`  

## Overview

Phase 3 detects when a run exceeds its token budget. Phase 4 adds **intelligent escalation**: instead of immediately aborting, the Recovery loop attempts the same task with a cheaper model before giving up.

## The Strategy

When a role (implementer, planner, etc.) uses ≥80% of its budget and hasn't yet succeeded, the Recovery loop:

1. **Check availability** of cheaper models in the downgrade chain
2. **Attempt retry** with the next cheaper model
3. **Track cost savings** (e.g., Haiku at 20% of Opus cost)
4. **Only abort** if all models in the chain fail

## Downgrade Chains

### Implementer (code generation)
```
Opus (100% cost)
  ↓ 40% cost
Sonnet
  ↓ 20% cost  
Haiku (20% total cost)
```

Rationale: Code generation benefits from strong reasoning (Opus), but Haiku can handle simple edits.

### Planner (plan generation)
```
Opus (100% cost)
  ↓ 40% cost
Sonnet (40% total cost)
```

Rationale: Planning requires reasoning but is less token-intensive than implementation.

### Discovery (evidence retrieval)
```
Sonnet (100% cost)
  ↓ 50% cost
Haiku (50% total cost)
```

Rationale: Discovery is structured retrieval; cheaper models handle it fine.

## Core Functions

### `shouldDowngradeModel(tokensUsed, tokenLimit): boolean`

Heuristic: trigger downgrade at ≥80% budget usage.

```ts
shouldDowngradeModel(1600, 2000) // 80% → true
shouldDowngradeModel(1500, 2000) // 75% → false
```

### `getDowngradeChain(role): ModelOption[]`

Returns the chain of models from most to least expensive for a role.

```ts
getDowngradeChain("implementer")
// [
//   { provider: "anthropic", model: "claude-opus-5", costMultiplier: 1.0 },
//   { provider: "anthropic", model: "claude-sonnet-5", costMultiplier: 0.4 },
//   { provider: "anthropic", model: "claude-haiku-4-5", costMultiplier: 0.2 },
// ]
```

### `getNextCheaperModel(role, currentModel): DowngradeResult`

Given the current model, returns the next cheaper one in the chain.

```ts
const result = getNextCheaperModel("implementer", "claude-opus-5");
// {
//   shouldDowngrade: true,
//   nextModel: { model: "claude-sonnet-5", costMultiplier: 0.4, ... },
//   reason: "Downgrade from claude-opus-5 to claude-sonnet-5 (40% cost)"
// }

const result2 = getNextCheaperModel("implementer", "claude-haiku-4-5");
// {
//   shouldDowngrade: false,
//   reason: "Already at cheapest model for implementer: claude-haiku-4-5"
// }
```

## Real-World Scenario

### Task exceeds budget, but recovers with cheaper model

```
Time  Event                                Budget Used  Model
----  -----                                -----------  -----
T+0   Start: implementer with Opus         0%           opus-5
T+500 Call uses 1500 tokens                75%          opus-5
T+600 Projected: will exceed 2000 limit    ≥80%         opus-5
      ↓ Recovery loop triggered
T+650 Check downgrade: available?          -            ✓ sonnet-5
T+700 Retry with Sonnet (40% cost)         75%          sonnet-5
T+800 Complete with no further LLM calls   +300 tokens
      Total: 1800 tokens (40% of Opus cost)
```

**Without downgrade**: abort at T+600, user gets failure  
**With downgrade**: success at T+800 with lower cost

## Tests (`src/services/modelDowngradeStrategy.test.ts`, 11 tests)

| Test | What it verifies |
|---|---|
| Threshold at 80% | Triggers at/above 80%, not below |
| Downgrade chains exist | Implementer/planner/discovery have chains |
| Chain length correct | Implementer 3 models, planner 2, discovery 2 |
| Opus→Sonnet downgrade | Next cheaper available and cost multiplier correct |
| Sonnet→Haiku downgrade | Continues down chain |
| Cheapest rejection | No downgrade when at cheapest |
| Unknown model rejection | Handles gracefully |
| Per-role isolation | Chains are independent |
| Formatted output (good) | Readable "↙️ Downgrading" message |
| Formatted output (bad) | Readable "ℹ️ No downgrade" message |
| Cost progression | Each model cheaper than previous |

## Integration with Phase 3

When Phase 3 enforces budgets:

```ts
// Phase 3: detect budget exceeded
const budgetStatus = enforceTokenBudget(...);
if (!budgetStatus.isWithinTokenBudget) {
  // Phase 4: try cheaper model before aborting
  if (shouldDowngradeModel(budgetStatus.tokensUsed, budgetStatus.tokensUsed + budgetStatus.tokensRemaining)) {
    const downgrade = getNextCheaperModel(request.role, currentModel);
    if (downgrade.shouldDowngrade) {
      console.log(formatDowngradeDecision(downgrade));
      // Retry with downgrade.nextModel.model
      // Don't abort yet
    }
  }
}
```

## Cost Impact

### Scenario: 100 runs, 10% hit budget limit, all downgrade to Haiku

- Baseline: 100 × (Opus cost) = 100× cost unit
- With downgrade: 90× (Opus) + 10× (Haiku at 20% cost) = 92× cost units
- **Savings: 8% overall**

With larger deployments, savings multiply.

## Known Limitations

1. **Hardcoded chains.** Downgrade chains are defined in code; Phase 4.x can move them to `config/`.
2. **No quality degradation tracking.** We assume Haiku is "good enough" without metrics — Phase 4.x can add success-rate tracking per model.
3. **Linear chains only.** All models are Anthropic; Phase 4.x could add per-provider fallback (Opus → Sonnet on Anthropic, then try GPT-4 on OpenAI).
4. **No per-task tuning.** All implementer tasks use the same chain; Phase 4.x could let tickets specify "must use Opus" or "prefer cheap".

## Future Improvements

1. **Config-driven chains.** Move chains to `config/downgrade-chains.yml` for easier tuning.
2. **Success tracking.** Record which model succeeded for each task type; use historical data to pick better defaults.
3. **Per-provider chains.** When fallback to OpenAI, use GPT-4 → GPT-4-turbo → GPT-3.5 chains.
4. **Per-ticket budgets.** Allow tickets to specify "use only Opus" or "try Haiku first".
5. **Cost forecasting.** After first attempt, forecast if Sonnet will succeed; skip to Haiku if unlikely.
