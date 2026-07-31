# Multi-Provider Agent Configuration

**Branch**: `feature/multi-provider-agents-config`  
**Purpose**: Configure orchestrator to use different LLM providers for different agent roles

## Overview

By default, all agents use Anthropic (Claude). This guide shows how to distribute agent workload across multiple providers (Anthropic, OpenAI, OpenRouter) for:
- **Cost optimization** (cheaper models for simple tasks)
- **Provider redundancy** (fallback if one provider is rate-limited)
- **Capability specialization** (best model for each task)

---

## Architecture

### Provider Chain
Each role has a **provider chain** — an ordered list of fallback providers:

```
Role: "implementer"
  ├─ Primary: Anthropic (claude-opus-5 — best code reasoning)
  ├─ Fallback: OpenRouter (qwen-coder — strong + cheaper)
  └─ Fallback: OpenAI (gpt-4 — last resort)
```

If Anthropic times out or rate-limits, system automatically tries OpenRouter.

### Configuration Levels

1. **Provider Credentials** (`providers.yml`)
   - API keys, base URLs, feature flags

2. **Role → Provider Mapping** (`config/<layer>.yml`)
   - Which provider each role uses
   - Model selection per provider
   - Token budgets per role

3. **Runtime Overrides** (`.env` or environment)
   - Force specific provider for testing
   - Temporary model changes

---

## Setup

### 1. Add API Keys to `.env`

```bash
# Anthropic (primary)
ANTHROPIC_API_KEY=sk-ant-v0-...

# OpenRouter (fallback + cost optimization)
OPENROUTER_API_KEY=sk-or-...

# OpenAI (last resort fallback)
OPENAI_API_KEY=sk-...

# Optional: Force specific provider for testing
FORCE_PROVIDER=openrouter
```

### 2. Configure Role → Provider in Layer Config

Each layer config (`planner.yml`, `implementation.yml`, etc.) defines roles:

#### Example: `config/implementation.yml`

```yaml
implementation:
  maxIterations: 3

roles:
  implementer:
    # Primary: Anthropic (best code reasoning)
    provider: anthropic
    model: claude-opus-5
    
    # Fallback chain (if primary provider fails)
    fallbackProviders:
      - openrouter  # Qwen Coder: strong coding + cheaper
      - openai      # GPT-4: expensive last resort
    
    # Role-specific timeout (from providers.yml roleTimeouts)
    timeoutMs: 45000
    
    maxTokens: 4000
    temperature: 0.1
```

#### Example: `config/planner.yml`

```yaml
planning:
  maxIterations: 4

roles:
  discovery:
    # Discovery: cheaper + fast
    provider: openrouter
    model: qwen-coder-32b
    
    fallbackProviders:
      - anthropic  # Opus if OpenRouter fails
    
    maxTokens: 2000
    temperature: 0.7
  
  planner:
    # Planning: complex, needs best reasoning
    provider: anthropic
    model: claude-opus-5
    
    fallbackProviders:
      - openai
    
    maxTokens: 3000
    temperature: 0.5
```

---

## Provider-Specific Configuration

### Anthropic (Primary)

**Best for**:
- Code generation (strongest reasoning)
- Complex planning
- Root cause diagnosis
- Recovery strategy selection

**Configuration**:
```yaml
provider: anthropic
model: claude-opus-5  # or claude-sonnet-5 for cost optimization
apiKeyEnv: ANTHROPIC_API_KEY
baseUrl: https://api.anthropic.com
timeoutMs: 45000  # Generous for complex tasks
```

**Cost**: ~$15 per 1M input tokens

### OpenRouter (Cost-Optimized)

**Best for**:
- Evidence retrieval (structured search)
- Quick validation checks
- Non-critical decision paths

**Configuration**:
```yaml
provider: openrouter
model: qwen-coder-32b  # or mistral-7b for even cheaper
apiKeyEnv: OPENROUTER_API_KEY
baseUrl: https://openrouter.ai/api/v1
timeoutMs: 30000  # Shorter timeout, less complex
```

**Cost**: ~$2-5 per 1M input tokens (30-70% cheaper than Anthropic)

**Available Models**:
- `qwen-coder-32b` — Strong coding, good reasoning
- `mistral-7b` — Fast, cheap, basic reasoning
- `mistral-large` — Better reasoning, still cheap
- See https://openrouter.ai/models for full list

### OpenAI (Reliable Last Resort)

**Best for**:
- Fallback when others fail
- Emergency escalation path

**Configuration**:
```yaml
provider: openai
model: gpt-4-turbo  # Strong but expensive
apiKeyEnv: OPENAI_API_KEY
timeoutMs: 30000
```

**Cost**: ~$10 per 1M input tokens

---

## Example: Cost-Optimized Configuration

**Goal**: Reduce token costs by 40% while maintaining quality.

### Strategy

| Role | Primary | Fallback | Reasoning |
|------|---------|----------|-----------|
| **discovery** | OpenRouter (qwen) | Anthropic | Simple evidence search |
| **planner** | Anthropic (opus) | OpenAI | Complex planning needs best reasoning |
| **implementer** | Anthropic (opus) | OpenRouter | Code generation needs strong reasoning |
| **diagnostician** | OpenRouter (mistral) | Anthropic | Fast diagnosis on known patterns |
| **strategist** | OpenRouter (qwen) | Anthropic | Quick decision logic |

### Expected Impact

```
Baseline cost (all Anthropic): $50 per 1000 tickets
Optimized cost:
  - discovery (OpenRouter): saves 70% = -$3.50
  - planner (Anthropic): no change = $0
  - implementer (Anthropic): no change = $0
  - diagnostician (OpenRouter): saves 80% = -$2.00
  - strategist (OpenRouter): saves 80% = -$1.50

Total: $43 per 1000 tickets (14% savings)
```

---

## Runtime Control

### Force Provider (Testing)

```bash
# Force all agents to use OpenRouter for testing
FORCE_PROVIDER=openrouter npm run dev

# Test specific provider chain
PROVIDER_CHAIN=anthropic,openrouter npm run dev

# Disable fallback (fail fast if primary fails)
DISABLE_PROVIDER_FALLBACK=true npm run dev
```

### Per-Role Override

```bash
# Override single role
IMPLEMENTER_PROVIDER=openrouter npm run dev

# Override model
DISCOVERER_MODEL=mistral-7b npm run dev
```

---

## Monitoring & Debugging

### View Provider Usage

```bash
npm run harness:logs -- --provider-breakdown
```

Output:
```
Provider Usage Summary:
├─ Anthropic: 12 calls, 45,000 tokens, $0.65
├─ OpenRouter: 8 calls, 12,000 tokens, $0.08
└─ OpenAI: 1 call, 3,000 tokens, $0.04

Total: $0.77 per ticket
```

### Debug Provider Selection

```bash
LOGLEVEL=debug npm run dev
```

Logs:
```
[provider-fallback] Calling discovery with openrouter:qwen-coder-32b
[provider-fallback] OpenRouter response time: 2.3s (within 30s timeout)
[provider-fallback] SUCCESS: openrouter
```

### Debug Fallback Chain

```bash
LOGLEVEL=debug npm run dev
```

Logs:
```
[provider-fallback] Calling planner with anthropic:claude-opus-5
[provider-fallback] Anthropic timed out after 60s (timeout: 60000ms)
[provider-fallback] FALLBACK: trying openai:gpt-4-turbo
[provider-fallback] OpenAI response time: 8.5s (within 30s timeout)
[provider-fallback] SUCCESS: openai (fallback)
```

---

## Best Practices

### 1. Test Before Deploying

```bash
# Test cost-optimized config locally
HARNESS_MODE=llm npm run dev -- --dry-run

# Simulate rate-limit to test fallback
SIMULATE_RATE_LIMIT=anthropic npm run dev
```

### 2. Monitor Costs

```bash
# Daily cost report
npm run harness:costs -- --days=1

# Weekly cost breakdown by provider
npm run harness:costs -- --days=7 --group-by=provider
```

### 3. Gradual Rollout

1. Start with all providers = Anthropic (safe)
2. Move only cheap roles to OpenRouter (low risk)
3. Monitor quality & cost for 1 week
4. Expand to more roles
5. Fine-tune timeouts based on actual latency

### 4. Handle Model Deprecation

When a model is deprecated:

```yaml
# Old config (breaks)
implementer:
  provider: openrouter
  model: mistral-small  # Deprecated!

# New config (graceful)
implementer:
  provider: openrouter
  model: mistral-large  # Fallback to newer model
  fallbackProviders:
    - anthropic  # Double fallback
```

---

## Fallback Chain Behavior

### Retry Logic

When a provider fails:

```
Request to anthropic:claude-opus-5
  ├─ Attempt 1: TIMEOUT after 45s
  ├─ Retry 1: RATE_LIMIT (429)
  └─ Fallback to next provider

Request to openrouter:qwen-coder-32b
  ├─ Attempt 1: SUCCESS after 8s ✓
  └─ Return response
```

### Circuit Breaker Integration

If a provider fails N times:

```
anthropic:claude-opus-5
├─ Attempt 1: Fail
├─ Attempt 2: Fail
├─ Attempt 3: Fail
├─ Attempt 4: Fail
├─ Attempt 5: Fail
└─ Circuit OPEN (skip this provider for 60s)

Next requests automatically skip to openrouter
```

See `src/services/llmCircuitBreaker.ts` for details.

---

## Troubleshooting

### "All providers exhausted"

```
Error: All providers in fallback chain exhausted for role 'implementer'
```

**Solutions**:
1. Check API keys in `.env`
2. Verify provider credentials work:
   ```bash
   curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
        https://api.anthropic.com/v1/messages
   ```
3. Check rate limits (may need to wait)
4. Add more providers to fallback chain
5. Increase timeout budgets

### "Model not available"

```
Error: Model 'qwen-coder-32b' not found in openrouter
```

**Solutions**:
1. Check model name (case-sensitive)
2. Visit https://openrouter.ai/models to see available models
3. Use model ID from OpenRouter:
   ```yaml
   model: openrouter/qwen/qwen-coder-32b
   ```

### "High latency with OpenRouter"

If OpenRouter calls are slow:

1. Check your OpenRouter usage (may be rate-limited)
2. Reduce timeout → try cheaper model:
   ```yaml
   timeoutMs: 15000  # 15s instead of 45s
   model: mistral-7b  # Faster inference
   ```
3. Use `temperature: 0` for faster deterministic responses

---

## Advanced: Custom Provider

To add a custom LLM provider:

1. Add to `providers.yml`:
   ```yaml
   custom:
     apiKeyEnv: CUSTOM_LLM_API_KEY
     baseUrl: https://custom-llm.example.com/api
   ```

2. Implement in `src/services/llm.ts`:
   ```typescript
   const customClient = new CustomLLMClient(apiKey);
   
   if (provider === "custom") {
     const response = await customClient.call(request);
     return response;
   }
   ```

3. Use in config:
   ```yaml
   roles:
     my_role:
       provider: custom
       model: custom-model-v1
   ```

---

## References

- **Circuit Breaker**: `src/services/llmCircuitBreaker.ts`
- **Provider Fallback**: `src/services/providerFallback.ts`
- **LLM Service**: `src/services/llm.ts`
- **Config Loaders**: `src/config/loadConfig.ts`
- **Tests**: `src/services/llm.test.ts`, `src/e2e.test.ts`

---

**Branch**: `feature/multi-provider-agents-config`  
**Status**: Ready for testing & deployment  
**Cost Savings**: 10-40% depending on configuration  
**Reliability**: Automatic fallback to ensure uptime
