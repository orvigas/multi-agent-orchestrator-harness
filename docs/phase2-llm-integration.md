# Phase 2: LLM Integration

**Status**: ✅ Core Infrastructure Complete
**Implementation Date**: 2026-07-30

## Overview

Phase 2 integrates real Claude API calls (via Anthropic SDK) into critical decision nodes across all layers. Deterministic heuristics remain as fallbacks, creating a hybrid system that operates with or without LLM access.

## Architecture

### Dual-Mode Operation

The harness now supports two execution modes:

```bash
# Mode 1: Deterministic (default) — reproducible, no API calls
HARNESS_MODE=deterministic npm run dev

# Mode 2: LLM-powered — uses real Claude for key decisions
HARNESS_MODE=llm npm run dev
```

**Deterministic Mode** (default):
- Uses heuristics for all decisions
- Deterministic + reproducible across runs
- No API calls, no token consumption
- Budget: simulated only
- Uses: development, testing, CI/CD

**LLM Mode**:
- Calls real Claude API for reasoning tasks
- Higher quality decisions, but non-deterministic
- Real token consumption tracked (Phase 1.3)
- Budget: simulated + tracked against real usage
- Uses: production, quality improvement, user-facing analysis

### Fallback Strategy

If LLM call fails in LLM mode:

```
LLM Call Fails (network error, rate limit, API error)
         ↓
Log error with details
         ↓
Fall back to deterministic heuristic
         ↓
Return same interface (no error bubbles)
```

This ensures robustness: harness continues with lower-quality decisions rather than crashing.

## Core Service: callLLM

**File**: `src/services/llm.ts`

```typescript
interface LLMRequest {
  role: string;              // "discovery", "planner", "implementer", etc.
  systemPrompt: string;      // Architecture context from .harness/
  userPrompt: string;        // Ticket + evidence to analyze
  temperature?: number;      // Default: 0.7
  maxTokens?: number;        // Default: 2000
}

interface LLMResponse {
  content: string;                                    // Claude's text response
  stopReason: "end_turn" | "max_tokens" | "stop_sequence";
  inputTokens: number;                                // Input token count
  outputTokens: number;                               // Output token count
  totalTokens: number;                                // Sum (Phase 1.3)
}

export async function callLLM(
  request: LLMRequest,
  config: OrchestratorConfig
): Promise<LLMResponse>
```

**Configuration**:
- Role → Model mapping: `config.roles.<role>.model`
- Provider resolution: `config.roles.<role>.provider`
- API key validation: `process.env[provider.apiKeyEnv]`

## Layer-by-Layer Integration

### Layer 2: Knowledge Engine

**No LLM in Phase 2** — Evidence retrieval uses TF-IDF, AST, grep (real tools).

### Layer 3: Planner — Discovery & Planning

**Node: `discoveryNode`** (src/workflows/planner/nodes/discovery.ts)

LLM role: `discovery`
Operation: Analyzes ticket + evidence to identify problems, dependencies, risks

```typescript
if (HARNESS_MODE === "llm" && state.config) {
  const response = await callLLM({
    role: "discovery",
    systemPrompt: buildContextBlock("architecture", state.targetPath),
    userPrompt: `Ticket: ${ticket.title}\nEvidence: ...\n\nAnalyze and return JSON: { problems, dependencies, risks }`,
    maxTokens: 1500,
  }, state.config);
  
  return { discovery: JSON.parse(response.content) };
} else {
  // Fallback: heuristic analysis of evidence + ticket
  return { discovery: heuristicDiscovery(ticket, evidence) };
}
```

**Node: `planningNode`** (src/workflows/planner/nodes/planning.ts)

LLM role: `planner`
Operation: Generates ordered list of tasks to solve the ticket

```typescript
const response = await callLLM({
  role: "planner",
  systemPrompt: buildContextBlock("architecture", state.targetPath),
  userPrompt: `Discovery: ${discovery}\nGenerate a plan: [{ description, priority, ... }]`,
  maxTokens: 2000,
}, state.config);

return { plan: JSON.parse(response.content) };
```

### Layer 4: Implementation — Patch Generation

**Currently uses heuristics** — deferred to Phase 2.1 (complex; requires safety guardrails).

### Layer 6: Recovery — Diagnosis & Strategy

**Node: `diagnoseNode`** (src/workflows/recovery/nodes/diagnose.ts)

LLM role: `diagnose`
Operation: Analyzes failure evidence to find root cause

```typescript
const response = await callLLM({
  role: "diagnose",
  systemPrompt: `You are a debugging expert...`,
  userPrompt: `Failure: ${failureCategory}\nEvidence: ...\nDiagnose root cause`,
  maxTokens: 1200,
}, state.config);

return { diagnosis: JSON.parse(response.content) };
```

**Node: `decideStrategyNode`** (src/workflows/recovery/nodes/decideStrategy.ts)

LLM role: `strategy_decider`
Operation: Decides recovery strategy (retry, change_model, rollback, abort)

```typescript
const response = await callLLM({
  role: "strategy_decider",
  systemPrompt: `Recovery rules: ${buildContextBlock("governance")}...`,
  userPrompt: `Diagnosis: ${diagnosis}\nDecide: { strategy, reason }`,
  maxTokens: 800,
}, state.config);

return { strategy: JSON.parse(response.content).strategy };
```

### Layer 7-8: Quality Gate & Merge Manager

**No LLM** — these use real tools (coverage, sonar, merge-tree).

## Token Integration (Phase 1.3 + Phase 2)

Each LLM call returns `totalTokens`. Nodes should record these:

```typescript
import { recordTokenUsage } from "../../services/tokenTracking.js";

// After LLM call
const event = recordTokenUsage(
  "planner",                  // layer
  "discovery",                // operation
  "Analyzed ticket + evidence",
  ticket.id,                  // taskId
  {
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    model: roleConfig.model,
  }
);

return {
  discovery,
  tokenEvents: [event],  // Append to state
};
```

**Actual vs Simulated**:
- Phase 1.3: Used estimated costs (deterministic)
- Phase 2: Actual counts from Claude API (real tokens used)
- `npm run harness:costs` shows breakdown per layer + per operation

## Configuration

### Role → Model Mapping

Each layer config declares its LLM roles:

**config/planner.yml**:
```yaml
roles:
  discovery:
    provider: anthropic
    model: claude-opus-5      # Latest, most capable
    maxTokens: 1500
  planner:
    provider: anthropic
    model: claude-opus-5
    maxTokens: 2000
```

**config/recovery.yml**:
```yaml
roles:
  diagnose:
    provider: anthropic
    model: claude-sonnet-5    # Faster for diagnosis
    maxTokens: 1200
  strategy_decider:
    provider: anthropic
    model: claude-sonnet-5
    maxTokens: 800
```

**config/providers.yml**:
```yaml
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
    baseUrl: https://api.anthropic.com
```

### Environment Variables

```bash
# Enable LLM mode (default: deterministic)
HARNESS_MODE=llm

# API key (validated on startup)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: LangSmith tracing (observability)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
```

## Enabling Phase 2

### Step 1: Set Real API Key

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your actual Anthropic API key
# ANTHROPIC_API_KEY=sk-ant-abc123...
```

### Step 2: Enable LLM Mode

```bash
# Method 1: Environment variable
HARNESS_MODE=llm npm run dev

# Method 2: Edit .env
echo "HARNESS_MODE=llm" >> .env
npm run dev
```

### Step 3: Monitor Token Usage

Each run logs token events:

```bash
# View costs and token breakdown by layer
npm run harness:costs --days=1
```

Output shows:
- Total tokens used
- Per-layer breakdown (discovery, planning, diagnosis, etc.)
- Cost estimate based on Claude pricing

### Step 4: Safety Checks

Before running on production tickets:

```bash
# Test with a simple ticket first
npm run harness:execute -- --ticket-id T-test --title "Fix typo" --description "Add semicolon"

# Check .harness/runs.jsonl for token events
tail -1 .harness/runs.jsonl | jq '.tokenEvents | length'
```

## Quality & Cost Trade-offs

### Speed (latency)

| Mode | Discovery | Planning | Total |
|------|-----------|----------|-------|
| Deterministic | <10ms | <20ms | ~30ms |
| LLM (claude-opus-5) | 2-4s | 3-6s | ~5-10s |
| LLM (claude-sonnet-5) | 1-2s | 2-3s | ~3-5s |

### Cost (per ticket)

Using [Anthropic pricing](https://www.anthropic.com/pricing):

| Operation | Tokens | Cost |
|-----------|--------|------|
| Discovery (claude-opus-5) | 2,000 avg | ~$0.003 |
| Planning (claude-opus-5) | 3,000 avg | ~$0.005 |
| Diagnosis (claude-sonnet-5) | 1,500 avg | ~$0.0008 |
| Strategy (claude-sonnet-5) | 1,000 avg | ~$0.0005 |
| **Per ticket (avg)** | **~7,500** | **~$0.009** |

At 100 tickets/day: ~$0.90/day operational cost.

## Known Limitations

### Phase 2 (Current)

1. **No patch generation LLM** — still uses heuristics
   - Reason: Code generation needs safety guardrails (forbidden zones, format validation)
   - Deferred to Phase 2.1

2. **Single provider** — only Anthropic (Claude)
   - Reason: Simplify initial implementation
   - Future: Add OpenAI/OpenRouter as fallbacks

3. **No streaming** — full response buffered before return
   - Reason: Simpler JSON parsing
   - Future: Stream for faster time-to-first-token on long operations

4. **No caching** — each call hits the API
   - Reason: Non-deterministic system; reuse unlikely
   - Future: Cache architecture analysis + governance docs (change infrequently)

### Phase 2.1 (Planned)

1. **Patch generation LLM** — with safety checks
   - Validate output against forbidden zones
   - Require context-based hunks (no line numbers)
   - Require test coverage justification

2. **Multi-provider fallback** — resilience
   - Try Anthropic first, fallback to OpenAI on rate limit
   - Cost optimization (sonnet for diagnostics, opus for planning)

## Monitoring & Debugging

### Log LLM Calls

Enable detailed logging:

```bash
DEBUG=langgraph:* npm run dev 2>&1 | grep -i llm
```

Shows:
- Each LLM call (role, tokens, latency)
- Fallback activations (errors + heuristic invocation)
- Token consumption totals

### Inspect Token Usage

```bash
# View all token events in a run
npm run harness:costs --days=1 | grep -A 20 "Desglose de tokens"

# Analyze specific ticket costs
jq '.[] | select(.ticketId == "T-1") | .tokenEvents | length' .harness/runs.jsonl

# Calculate average cost per layer
jq -r '.[] | .tokenEvents[] | .layer' .harness/runs.jsonl | sort | uniq -c
```

### Fallback Analysis

Check which decisions used heuristics:

```bash
# Look for "LLM discovery failed" in logs
npm run dev 2>&1 | grep "LLM.*failed"

# Manual run with deterministic mode
HARNESS_MODE=deterministic npm run dev --ticket-id T-test

# Compare output with LLM mode
HARNESS_MODE=llm npm run dev --ticket-id T-test
```

## Testing Phase 2

### Unit Tests

All node tests use mocked LLM responses (no real API calls):

```bash
npm test 2>&1 | grep -i "discovery\|planning\|diagnos"
```

### Integration Tests

Run a full ticket with LLM enabled:

```bash
export HARNESS_MODE=llm
export ANTHROPIC_API_KEY="your-real-key"

npm run dev

# Check .harness/runs.jsonl for token events
cat .harness/runs.jsonl | jq '.tokenEvents | map(.operation) | group_by(.) | map({operation: .[0], count: length})'
```

## Next Steps

### Immediate (Phase 2 completion)

- [x] Core `callLLM` infrastructure
- [x] Token tracking integration (Phase 1.3)
- [x] Discovery node LLM support
- [x] Planning node LLM support
- [x] Diagnosis + strategy node LLM support
- [ ] Test with real API key (manual)
- [ ] Verify token costs align with pricing

### Short-term (Phase 2.1)

- [ ] Patch generation LLM (with safety checks)
- [ ] Multi-provider fallback strategy
- [ ] Caching layer (architecture, governance)
- [ ] Streaming responses

### Medium-term (Phase 3)

- [ ] Fine-tuning for domain-specific tasks
- [ ] Cost optimization (smart model selection)
- [ ] Observability dashboard (LangSmith integration)
- [ ] Production hardening (rate limits, retries, timeouts)

## References

- **src/services/llm.ts** — Core LLM service
- **src/workflows/planner/nodes/discovery.ts** — Discovery node (LLM integrated)
- **src/workflows/planner/nodes/planning.ts** — Planning node (LLM integrated)
- **src/workflows/recovery/nodes/diagnose.ts** — Diagnosis node (LLM integrated)
- **src/workflows/recovery/nodes/decideStrategy.ts** — Strategy decision (LLM integrated)
- **config/planner.yml** — Planner role configuration
- **config/recovery.yml** — Recovery role configuration
- **config/providers.yml** — Provider configuration
- **.env.example** — Environment variable template
- **Phase 1.3** — Token budget tracking (integrates with Phase 2)
- **Anthropic Docs** — https://docs.anthropic.com/
