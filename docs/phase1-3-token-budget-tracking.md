# Phase 1.3: Token Budget Tracking & Enforcement

**Status**: ✅ Complete
**Implementation Date**: 2026-07-30

## Overview

Phase 1.3 implements comprehensive token budget tracking across all layers of the Orchestrator. This enables detailed visibility into how tokens are consumed by each layer, operation type, and task, plus enforcement mechanisms to prevent budget overruns.

## Architecture

### Token Tracking Service

**File**: `src/services/tokenTracking.ts`

Core components:

```typescript
// Record a token usage event
recordTokenUsage(
  layer: LayerName,
  operation: OperationType,
  reason: string,
  taskId?: string,
  details?: Record<string, unknown>
): TokenUsageEvent

// Summarize usage per layer
summarizeTokenUsageByLayer(events: TokenUsageEvent[]): TokenLayerSummary[]

// Calculate budget status with warnings
calculateBudgetStatus(
  totalUsed: number,
  totalLimit: number,
  events: TokenUsageEvent[]
): TokenBudgetStatus

// Format for display
formatBudgetStatus(status: TokenBudgetStatus): string
```

### Layer Names (8 total)

```typescript
type LayerName =
  | "orchestrator"
  | "knowledge_engine"
  | "planner"
  | "implementation"
  | "validation_pipeline"
  | "recovery"
  | "quality_gate"
  | "merge_manager";
```

### Operation Types (12 types)

```typescript
type OperationType =
  | "discovery"              // Knowledge Engine layer 2
  | "evidence_retrieval"     // Retrieving evidence
  | "evidence_ranking"       // Ranking evidence
  | "plan_generation"        // Planner layer 3
  | "plan_validation"        // Validating plan
  | "patch_generation"       // Implementation layer 4
  | "patch_review"           // Reviewing patch
  | "diagnosis"              // Recovery layer 6
  | "strategy_decision"      // Deciding recovery strategy
  | "quality_check"          // Quality Gate layer 7
  | "conflict_detection"     // Merge Manager layer 8
  | "merge_execution";       // Executing merge
```

### Token Usage Event

```typescript
interface TokenUsageEvent {
  timestamp: string;           // ISO 8601 timestamp
  layer: LayerName;           // Which layer generated this
  operation: OperationType;   // What kind of work
  tokensUsed: number;         // Tokens consumed
  reason: string;             // Human-readable reason
  taskId?: string;            // Which task (if applicable)
  details?: Record<string, unknown>;  // Extra metadata
}
```

## State Integration

The Orchestrator state now includes a `tokenEvents` field:

```typescript
tokenEvents: Annotation<TokenUsageEvent[]>({
  reducer: (prev, next) => prev.concat(next),
  default: () => [],
})
```

**Semantics**:
- Accumulated across entire run (never cleared between tickets)
- Each layer appends events as it executes
- Passed through checkpointer (survives resumption)

## Implementation Details

### Token Estimation (Simulated)

Current token costs per operation (configurable):

| Operation | Tokens |
|-----------|--------|
| discovery | 1,000 |
| evidence_retrieval | 500 |
| evidence_ranking | 200 |
| plan_generation | 2,000 |
| plan_validation | 1,500 |
| patch_generation | 1,500 |
| patch_review | 800 |
| diagnosis | 1,200 |
| strategy_decision | 800 |
| quality_check | 600 |
| conflict_detection | 400 |
| merge_execution | 200 |

**Phase 1.3 current status**: Deterministic simulated values (no real LLM)
**Phase 2 roadmap**: Replace with actual token counter from Claude SDK

### Recording Events

Example from Implementation Layer (src/orchestrator/nodes/implementation.ts):

```typescript
const tokenEvents = promotedTaskIds.map((taskId) =>
  recordTokenUsage(
    "implementation",
    "patch_generation",
    `Patch generated for task ${taskId}`,
    taskId,
    { costUsd: SIMULATED_COST_USD_PER_TASK }
  )
);
```

Then append to state:
```typescript
return {
  tokenBudget,
  costBudget,
  tokenEvents,  // Returned from node
  // ... rest of state
};
```

## Budget Status & Warnings

### Warning Thresholds

- **75% used**: ⚠️ Warning
- **90% used**: 🚨 Critical
- **Per-layer > 30% of total**: ⚠️ Layer over-consuming

### Example Output

```
Token Budget Status
Total: 90000/200000 (45.0% used)
Remaining: 110000 tokens

By layer:
  implementation: 45000 tokens (22.5%, 30 events)
  planner: 30000 tokens (15.0%, 15 events)
  knowledge_engine: 15000 tokens (7.5%, 10 events)

Warnings:
  ⚠️  implementation is using 22.5% of total budget
```

## Reporting

### harness:costs Command

Updated to show per-layer breakdown:

```bash
npm run harness:costs --days=7
```

Output includes:
- Total runs in period
- Total tokens (simulated)
- Total cost (simulated)
- **New**: Per-layer token breakdown with percentages

Example:
```
Corridas en los últimos 7 día(s): 3
Tokens (simulados): 45000
Costo (simulado): $0.9000

=== Desglose de tokens por capa ===
implementation: 25000 tokens (55.6%, 25 eventos)
planner: 15000 tokens (33.3%, 12 eventos)
knowledge_engine: 5000 tokens (11.1%, 8 eventos)
```

### Run Log Entry

Each completed run stores token events in `.harness/runs.jsonl`:

```json
{
  "timestamp": "2026-07-30T12:00:00Z",
  "ticketId": "T-1",
  "status": "done",
  "tokenBudget": { "limit": 200000, "used": 15000 },
  "costBudget": { "limitUsd": 5, "usedUsd": 0.30 },
  "tokenEvents": [
    {
      "timestamp": "2026-07-30T12:00:10Z",
      "layer": "implementation",
      "operation": "patch_generation",
      "tokensUsed": 1500,
      "reason": "Patch generated for task task-1"
    },
    ...
  ]
}
```

## Testing

11 tests cover token tracking functionality:

```bash
npm test -- src/services/tokenTracking.test.ts
```

Tests verify:
- Event recording with correct structure
- Token estimation for each operation type
- Layer-based summarization
- Budget status calculation
- Warning thresholds (75%, 90%)
- Per-layer operation breakdown
- Formatted output

All 144 tests pass (including Phase 1.1 & 1.2).

## Configuration

### Orchestrator Config

Token budget limits in `config/orchestrator.yml`:

```yaml
orchestrator:
  tokenBudget:
    limit: 200000  # Tokens per run
  costBudget:
    limitUsd: 5    # USD per run (simulated)
  deadlineMinutes: 60
```

To modify budgets:
```bash
# Edit config/orchestrator.yml
# Then restart harness
npm run dev
```

### Environment Variables

None currently required for Phase 1.3. Configuration is entirely YAML-based.

## Known Limitations

### Phase 1.3 (Current)

1. **No LLM integration** — Token estimates are deterministic, not based on actual model calls
   - Reason: Layers don't call LLMs yet (see `.claude/CLAUDE.md`)
   - Workaround: Modify `estimateTokensForOperation()` for custom costs

2. **No enforcement** — Budget status is tracked but doesn't block execution
   - Reason: Deterministic operations can't fail due to budget
   - Deferred to Phase 2 when LLM calls are live

3. **No cost allocation** — Costs are tied to simulated operations, not actual provider billing
   - Reason: No real LLM calls
   - Deferred to Phase 2

### Phase 2 (Planned)

1. **Live LLM token counting** — Integrate Claude SDK token counter
   - Call `countTokens()` after each LLM invocation
   - Record actual usage instead of estimates

2. **Enforcement** — Block execution if budget would be exceeded
   - Check before expensive operations (Discovery, Planning)
   - Escalate to Recovery if blocked

3. **Real cost tracking** — Wire provider billing
   - Track usage per provider (Anthropic, OpenAI, etc.)
   - Integrate with spend alerts

## Migration Path

### From Phase 1.2 to 1.3

If you have checkpoints from Phase 1.2:

```bash
# Existing checkpoints are compatible (new field is optional)
# No migration needed — tokenEvents defaults to []
npm run dev
```

### From Phase 1.3 to Phase 2 (LLM integration)

When Phase 2 adds real LLM calls:

1. Create `src/services/realTokenCounter.ts` with Claude SDK integration
2. Replace simulated `estimateTokensForOperation()` with real counter
3. Update layers to call counter after LLM invocations
4. Add enforcement logic to routes (budget_guard node)

## Examples

### Recording a discovery operation (Knowledge Engine layer)

```typescript
import { recordTokenUsage } from "../../services/tokenTracking.js";

// In knowledge engine discovery node
const tokenEvent = recordTokenUsage(
  "knowledge_engine",
  "discovery",
  "Searching for relevant evidence",
  ticket.id,
  { keywords: ["async", "callback"], resultCount: 42 }
);

// Return with event
return {
  // ... discovery results
  tokenEvents: [tokenEvent],
};
```

### Querying budget status programmatically

```typescript
import { calculateBudgetStatus, formatBudgetStatus } from "../services/tokenTracking.js";

const status = calculateBudgetStatus(
  state.tokenBudget.used,
  state.tokenBudget.limit,
  state.tokenEvents
);

if (status.percentUsed > 75) {
  console.warn(formatBudgetStatus(status));
}
```

### Analyzing costs per layer

```typescript
import { summarizeTokenUsageByLayer } from "../services/tokenTracking.js";

const layers = summarizeTokenUsageByLayer(finalState.tokenEvents);
for (const layer of layers) {
  console.log(`${layer.layer}: ${layer.totalTokens} tokens`);
}
```

## References

- **src/services/tokenTracking.ts** — Core tracking service
- **src/services/tokenTracking.test.ts** — 11 tests
- **src/orchestrator/state.ts** — tokenEvents annotation
- **src/orchestrator/nodes/implementation.ts** — Usage example
- **src/orchestrator/harnessCosts.ts** — Reporting integration
- **config/orchestrator.yml** — Budget configuration
- **Phase 1.1** — Persistence layer (SQLite)
- **Phase 1.2** — Docker sandbox isolation
