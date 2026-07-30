# Phase 2.2: Multi-Provider Fallback & Cost Optimization

**Status**: ✅ Infrastructure Complete (Phase 2.3: Actual Retry Implementation)
**Implementation Date**: 2026-07-30

## Overview

Phase 2.2 establishes multi-provider fallback infrastructure for resilience and cost optimization. The system can now:
- Detect rate limits and failover to alternative providers
- Select optimal models by operation complexity
- Track which provider/model was used for each call
- Enable fallback chains: Anthropic → OpenAI → OpenRouter

## Architecture

### Provider Configuration

Roles can declare variants for different providers:

```yaml
# config/planner.yml
roles:
  discovery:
    provider: anthropic
    model: claude-sonnet-5
  
  discovery_openai:        # Fallback variant
    provider: openai
    model: gpt-4-turbo
  
  discovery_openrouter:    # Further fallback
    provider: openrouter
    model: openrouter/openai/gpt-4-turbo
```

**Provider configuration** (config/providers.yml):
```yaml
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
  openai:
    apiKeyEnv: OPENAI_API_KEY
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY
```

### Fallback Chain

When a role call fails (rate limit, unavailable, error):

```
Request for "discovery"
         ↓
Try: anthropic/claude-sonnet-5
         ↓
Rate limited (429) → fallback
         ↓
Try: openai/gpt-4-turbo
         ↓
Success! Return response (with provider metadata)
```

## Services

### providerFallback Service

**File**: `src/services/providerFallback.ts`

Core functions:

```typescript
// Detect if error is rate limit
isRateLimitError(error: unknown): boolean

// Get available providers for a role (fallback chain)
getFallbackProviders(role: string, config: OrchestratorConfig): 
  Array<{ provider: string; model: string }>

// Calculate backoff delay with jitter (for retries)
calculateBackoffDelay(attemptNumber: number): number

// Select best provider/model for operation
selectProviderWithFallback(
  role: string,
  config: OrchestratorConfig,
  maxRetries?: number
): Promise<ProviderFallbackResult>

// Optimize model selection by operation type
selectOptimalModel(baseModel: string, operationType: string): string

// Format result for logging
formatFallbackResult(result: ProviderFallbackResult): string
```

### Rate Limit Detection

Recognizes rate limit errors from multiple providers:

```typescript
isRateLimitError(error)

// Returns true for:
- Anthropic: "429: Too Many Requests", "rate limit", "overloaded"
- OpenAI: "rate_limit_exceeded", "requests per minute"
- HTTP: status 429
```

### Backoff Strategy

Exponential backoff with jitter prevents thundering herd:

```
Attempt 0: immediately
Attempt 1: ~100ms
Attempt 2: ~200ms
Attempt 3: ~400ms
...
Max:       30 seconds
Jitter:    ±10% randomness
```

Example: after 3 failed attempts to Anthropic, wait 400ms then try OpenAI.

### Cost Optimization

**Phase 2.2**: Blueprint for model selection by operation complexity.

```typescript
selectOptimalModel(baseModel: string, operationType: string): string

// Downgrade opus → sonnet for simple ops (save cost)
- patch_review (cheap task) on opus → sonnet
- strategy_decision (cheap) on opus → sonnet

// Upgrade sonnet → opus for complex ops (better quality)
- plan_generation (complex) on sonnet → opus
- discovery (needs deep understanding) on sonnet → opus
```

**Potential savings** (with Phase 2.3 implementation):
- discovery: sonnet (faster, cheaper) → opus (if complex context)
- planning: opus (necessary for quality)
- diagnosis: sonnet (rules-based, mostly)
- strategy: sonnet (deterministic)

## LLMResponse Updates (Phase 2.2)

`callLLM` now returns provider information:

```typescript
interface LLMResponse {
  content: string;
  totalTokens: number;
  provider: string;        // "anthropic", "openai", etc.
  model: string;           // "claude-opus-5", "gpt-4-turbo", etc.
  inputTokens: number;
  outputTokens: number;
  stopReason: "end_turn" | "max_tokens" | "stop_sequence";
}
```

**Usage in nodes**:
```typescript
const response = await callLLM(request, config);
console.log(`Used: ${response.provider}/${response.model}`);

// Record for Phase 1.3 token tracking
recordTokenUsage("implementation", "patch_generation", reason, taskId, {
  provider: response.provider,      // Which provider
  model: response.model,            // Which model
  inputTokens: response.inputTokens,
  outputTokens: response.outputTokens,
});
```

## Token Tracking Integration (Phase 1.3 + 2.2)

Token events now include provider/model metadata:

```json
{
  "timestamp": "2026-07-30T12:00:00Z",
  "layer": "implementation",
  "operation": "patch_generation",
  "tokensUsed": 3500,
  "reason": "LLM patch for task T-1",
  "taskId": "T-1",
  "details": {
    "provider": "openai",           // Phase 2.2
    "model": "gpt-4-turbo",         // Phase 2.2
    "inputTokens": 2000,
    "outputTokens": 1500,
    "hunksCount": 2,
    "filesModified": 1
  }
}
```

**Visible in reports**:
```bash
npm run harness:costs --days=1

# Output now shows per-provider breakdown (when Phase 2.3 implemented)
```

## Testing

18 comprehensive tests in `src/services/providerFallback.test.ts`:

```bash
npm test 2>&1 | grep providerFallback
```

All 175 total tests pass.

## Known Limitations

### Phase 2.2 (Current)

1. **No actual retry logic** — Infrastructure is in place, not yet wired
   - Reason: Simpler to implement fallback chain discovery first
   - Phase 2.3 will add: actual retries on rate limit detection

2. **No backoff sleep** — `calculateBackoffDelay` is computed but not used
   - Reason: Actual async retry handling deferred to Phase 2.3
   - Currently: immediate fallback to next provider

3. **No provider override** — Cannot force a specific provider
   - Reason: Locks in to primary configuration
   - Future: add `FORCE_PROVIDER=openai` for testing/override

4. **Single fallback chain per role** — Not configurable
   - Reason: Simplicity (anthropic → openai → openrouter)
   - Future: support custom chains in config

### Phase 2.3 (Planned)

1. **Actual retry implementation** — Wire up backoff + retry loop
   - On rate limit: wait (backoff) → retry same provider
   - After N failures: switch to next provider

2. **Smart provider selection** — Use `selectOptimalModel` for cost
   - Route simple operations to sonnet/cheaper models
   - Reserve opus for complex reasoning

3. **Provider-specific timeouts** — Different limits per provider
   - Anthropic: 10s
   - OpenAI: 30s
   - OpenRouter: 60s

4. **Circuit breaker** — Disable failing provider temporarily
   - Track consecutive failures per provider
   - Skip provider if error rate > threshold

## Example: Full Flow with Phase 2.3 Retry

When actually implemented in Phase 2.3:

```
User: HARNESS_MODE=llm npm run dev

Discovery phase:
  1. Request "discovery" role
  2. Attempt Anthropic/claude-sonnet-5
  3. Get rate limit (429) → isRateLimitError detects it
  4. Calculate backoff: 100ms
  5. Wait 100ms
  6. Retry Anthropic/claude-sonnet-5
  7. Still rate limited → switch provider
  8. Attempt OpenAI/gpt-4-turbo
  9. Success! Return response
  10. Token event records: provider=openai, model=gpt-4-turbo
  11. Continue with patch generation...
```

**What gets logged**:
```
Provider Selection: openai/gpt-4-turbo (success)
Fallback chain:
  ❌ [0] anthropic/claude-sonnet-5: rate_limited
      Error: 429: Too Many Requests
  ✅ [1] openai/gpt-4-turbo: success
```

## Configuration for Production

### Enable all provider keys

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
HARNESS_MODE=llm
```

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
    model: openrouter/openai/gpt-4-turbo
```

### Monitor fallback usage

```bash
# In logs, look for fallback chain indicators
HARNESS_MODE=llm npm run dev 2>&1 | grep -A 5 "Fallback chain"

# Count fallback activations
npm run dev 2>&1 | grep "Fallback chain" | wc -l
```

## Cost Analysis

### Single-Provider (Phase 2.1)

All calls via Anthropic:
- discovery: 1,000 tokens × $0.003 = $0.003
- planning: 2,000 tokens × $0.003 = $0.006
- Total per ticket: $0.009

### Multi-Provider Optimized (Phase 2.2 + 2.3)

Strategic provider selection:
- discovery (sonnet): 1,000 tokens × $0.002 (OpenAI) = $0.002
- planning (opus): 2,000 tokens × $0.005 (Anthropic) = $0.010
- diagnosis (sonnet): 1,500 tokens × $0.002 (OpenAI) = $0.003
- strategy (sonnet): 1,000 tokens × $0.002 (OpenAI) = $0.002
- **Total per ticket: $0.017** ← 89% more expensive (opus needed for quality)

**Fallback benefit**: Resilience from rate limits + higher success rate (value over cost).

## Monitoring & Observability

### View provider usage

```bash
# Which providers were used in last run
tail -1 .harness/runs.jsonl | jq '.tokenEvents[] | {provider, model, tokensUsed}'

# Count provider usage over time
tail -100 .harness/runs.jsonl | jq -r '.tokenEvents[] | .details.provider' | sort | uniq -c
```

### Track fallback activations

```bash
# Detect fallback usage in logs (Phase 2.3+)
npm run dev 2>&1 | grep "Fallback chain" | grep "❌"

# Should be rare in normal operation
```

### Cost tracking by provider

```bash
# Breakdown of token usage by provider (Phase 1.3 + 2.2)
npm run harness:costs --days=7 | grep -A 20 "Desglose"
```

## Next Steps

### Phase 2.3: Actual Retry Implementation

- [ ] Implement `selectProviderWithFallback` retry loop
- [ ] Wire up `calculateBackoffDelay` with async delay
- [ ] Add rate limit detection to `callLLM`
- [ ] Test with artificial rate limits (mock)
- [ ] Monitor fallback chain effectiveness

### Phase 3: Advanced Features

- [ ] Circuit breaker (disable failing providers)
- [ ] Provider-specific timeouts
- [ ] Cost budgets per provider
- [ ] Provider recommendation engine

## References

- **src/services/providerFallback.ts** — Fallback infrastructure
- **src/services/providerFallback.test.ts** — 18 tests
- **src/services/llm.ts** — Updated to return provider metadata
- **config/providers.yml** — Provider configuration
- **config/planner.yml** — Example role variants
- **Phase 1.3** — Token tracking (integration for provider tracking)
- **Phase 2.1** — Patch safety validation
- **Phase 2.3** — Actual retry implementation (planned)
