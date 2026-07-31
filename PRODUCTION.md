# Production Deployment Guide

This guide covers deploying the Multi-Agent Harness to production environments.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy production env file (or set vars in your deployment platform)
cp .env.production .env

# 3. Update API keys in .env
# ANTHROPIC_API_KEY=sk-ant-v0-...
# OPENAI_API_KEY=sk-...
# OPENROUTER_API_KEY=sk-or-...

# 4. Enable LLM Mode (real LLM calls instead of deterministic heuristics)
export HARNESS_MODE=llm

# 5. Run the Orchestrator on your target repository
npm run dev -- --target /path/to/repo
```

## System Requirements

### Node.js & npm
- **Node.js**: v18.0.0 or higher (see `engines` in `package.json`)
- **npm**: v8.0.0 or higher
- **Platform**: macOS, Linux, or Windows (with appropriate git integration)

### Disk Space
- **Installation**: ~500 MB (node_modules)
- **Database**: ~1-10 MB per 1000 checkpoints (SQLite, auto-cleanup available)
- **Runtime temp**: Sandboxed copies of target repos (typically freed after validation)

### Network (for LLM Mode)
- **Internet connectivity** required to reach API endpoints:
  - Anthropic: `api.anthropic.com:443`
  - OpenAI: `api.openai.com:443`
  - OpenRouter: `openrouter.ai:443`
- **Low latency** recommended for best performance

## Environment Configuration

Create a `.env` file in the project root (git-ignored, never committed):

```bash
cp .env.production .env
```

Edit `.env` and add your actual API keys:

### Required API Keys

#### Anthropic (Claude models)
```
ANTHROPIC_API_KEY=sk-ant-v0-...
```
- Get key: https://console.anthropic.com/account/keys
- Used for roles: discovery, planner, implementer, recovery_diagnostician

#### OpenAI (GPT-4o, Turbo)
```
OPENAI_API_KEY=sk-...
```
- Get key: https://platform.openai.com/account/api-keys
- Used as fallback provider (configurable in `config/providers.yml`)

#### OpenRouter (Proxy for multiple providers)
```
OPENROUTER_API_KEY=sk-or-...
```
- Get key: https://openrouter.ai/keys
- Useful for accessing multiple providers with one key + rate limiting

### Configuration

#### HARNESS_MODE: Deterministic vs. LLM
```bash
HARNESS_MODE=llm           # Use real LLM calls (production)
HARNESS_MODE=deterministic # Use heuristics only (testing, reproducible)
```

**Default**: `deterministic`
- Doesn't consume tokens or require API keys
- 100% reproducible output
- Useful for testing infrastructure before enabling LLM

**Production**: `llm`
- Calls Claude via Anthropic API for intelligent patch generation
- Consumes tokens (billed at standard Anthropic rates)
- Better quality patches but higher latency
- Enable when ready for real code changes

#### Checkpoint Database: SQLite (default) or PostgreSQL

**SQLite** (single-process, recommended for MVP):
```bash
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db
```
- Auto-creates `./data/` directory on startup
- Lightweight file-based storage
- No server required
- Thread-safe for single-process deployments

**PostgreSQL** (multi-process, Phase 1.3):
```bash
CHECKPOINT_DB_URL=postgres://user:password@localhost:5432/orchestrator
```
- Requires `@langchain/langgraph-checkpoint-postgres` (future implementation)
- Supports multiple concurrent Orchestrator instances
- Persistent state across deployments

#### Optional: LangSmith Observability
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
LANGCHAIN_PROJECT=multiagent-harness
```
- Get key: https://smith.langchain.com/settings/api-keys
- Streams traces asynchronously (zero overhead)
- Useful for debugging and monitoring token usage

## Running the Orchestrator

### Basic Usage

```bash
# Process the default demo backlog against the harness itself
npm run dev

# Process a specific repository
npm run dev -- --target /path/to/repo

# Create an ad-hoc single ticket
npm run dev -- --target /path/to/repo \
  --ticket-id "PROD-1" \
  --title "Fix authentication bug" \
  --description "Users report 403 on login after restart"

# Load tickets from a JSON file
npm run dev -- --target /path/to/repo --backlog tickets.json
```

### Backlog JSON Format

Create a `tickets.json` file for batch processing:

```json
[
  {
    "id": "PROD-1",
    "title": "Fix critical authentication bug",
    "description": "Session tokens expire incorrectly after restart",
    "status": "pending"
  },
  {
    "id": "PROD-2",
    "title": "Optimize database query performance",
    "description": "Dashboard loads slowly (>5s) on large datasets",
    "status": "pending"
  }
]
```

Then run:
```bash
npm run dev -- --target /path/to/repo --backlog tickets.json
```

## Monitoring & Debugging

### Logs

The Orchestrator outputs structured logs to stdout:

```
🔧 Initializing checkpoint database...
✅ Checkpoint database ready: ./data/harness-checkpoints.db
🚀 Initializing Orchestrator...
🎯 Starting Orchestrator...

[TIMESTAMP] (knowledge_engine) Ticket T-1: 4 items of evidence in 2/5 iterations
[TIMESTAMP] (planning) Ticket T-1: Discovery/Planning/Validation -> valid in 1/3 iterations
[TIMESTAMP] (implementation) Implementation Loop escalated (quick-check: compile)
[TIMESTAMP] (recovery) Ticket T-1: rootCause=Compilation -> retry_planning
```

### Exit Codes

- `0`: Success (all tickets processed, no blockers)
- `1`: Fatal error (missing env var, database error, invalid target repo)
- Other: Orchestrator ran but some tickets failed (check decision log)

### Token Usage & Costs

Enable LangSmith tracing to monitor:
- Tokens consumed per role (discovery, planner, implementer, recovery)
- Estimated cost (based on Anthropic pricing)
- Latency per LLM call
- Error rates and retry patterns

Dashboard: https://smith.langchain.com/

## Deployment Strategies

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .

# Copy production env template
COPY .env.production .env

# Create data directory for SQLite
RUN mkdir -p ./data

# Run Orchestrator
ENV NODE_ENV=production
ENV HARNESS_MODE=llm
CMD ["npm", "run", "dev", "--", "--target", "/target-repo"]
```

Build & run:
```bash
docker build -t orchestrator:latest .
docker run -e ANTHROPIC_API_KEY=sk-ant-v0-... \
           -e OPENAI_API_KEY=sk-... \
           -v /path/to/repo:/target-repo \
           -v /data/orchestrator:/app/data \
           orchestrator:latest
```

### GitHub Actions

```yaml
name: Run Orchestrator

on:
  workflow_dispatch:
    inputs:
      target_repo:
        description: "Target repository URL"
        required: true

jobs:
  orchestrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          repository: ${{ github.event.inputs.target_repo }}
          path: target-repo

      - uses: actions/checkout@v3
        path: orchestrator

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: cd orchestrator && npm ci

      - name: Run Orchestrator
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          HARNESS_MODE: llm
        run: |
          cd orchestrator
          npm run dev -- --target ../target-repo

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: orchestrator-logs
          path: orchestrator/data/
```

## Troubleshooting

### Missing API Key
```
Error: Falta la variable de entorno ANTHROPIC_API_KEY para el provider "anthropic"
```
**Solution**: Add the key to `.env` or environment

### Database Lock Error
```
Error: SQLITE_BUSY: database is locked
```
**Solution**: Ensure only one Orchestrator instance runs at a time (SQLite limitation). Use PostgreSQL for concurrent access.

### Timeout on LLM Call
```
Error: LLMTimeoutError: Anthropic timeout after 30000ms
```
**Solution**: Increase role-specific timeout in `config/providers.yml` under `roleTimeouts`

### Target Repository Not Found
```
Error: Target repo not found: /path/to/repo
```
**Solution**: Verify the path exists and is a directory

### Checkpoint Database Corruption
```
Error: database disk image is malformed
```
**Solution**: Delete `./data/harness-checkpoints.db` and restart (state is lost but harness continues). For production: ensure database file is on reliable storage.

## Production Checklist

- [ ] Node.js v18+ installed
- [ ] API keys obtained for at least one provider
- [ ] `.env` file created and populated (never committed)
- [ ] `CHECKPOINT_DB_PATH` directory writable
- [ ] Network access verified to provider endpoints
- [ ] Dry run completed: `HARNESS_MODE=deterministic npm run dev -- --target /test/repo`
- [ ] LLM mode tested: `HARNESS_MODE=llm npm run dev -- --target /test/repo`
- [ ] Monitoring/observability set up (LangSmith recommended)
- [ ] Backlog format validated (if using `--backlog`)
- [ ] Deployment method chosen (Docker/GitHub Actions/bare metal)

## Performance & Scaling

### Single-Process Performance
- **Throughput**: ~1-3 tickets/hour (depends on code complexity, LLM latency)
- **Memory**: ~200-500 MB (increases with large repos)
- **Database**: <10 MB per 1000 checkpoints (auto-cleanup recommended)

### Scaling Beyond MVP
- **Multiple instances**: Switch to PostgreSQL (Phase 1.3)
- **Queue-based processing**: Integrate with Temporal/Bull/RabbitMQ
- **Caching**: Implement Redis for vector embeddings (Knowledge Engine)
- **Rate limiting**: Use OpenRouter for better provider rate handling

## Support & Monitoring

### Key Metrics to Track
- **Tickets processed**: Total & success rate
- **Token consumption**: Per provider, per role
- **Estimated cost**: Based on actual LLM calls
- **Latency**: End-to-end per ticket, per subgraph
- **Error rates**: By failure category (Security, Compilation, Tests, etc.)

### Integration Points
- **Webhooks**: Add via Phase 2.5 (not yet implemented)
- **Metrics export**: Prometheus/CloudWatch (add collectors)
- **Alerting**: Set thresholds on token budget, latency, error rate

## Next Steps

After successful deployment:

1. **Enable more advanced features** (Phases 2-7)
   - Real LLM patch generation (Phase 2.1)
   - Provider fallback & circuit breaker (Phase 2.3)
   - Quality Gate review loop (Phase 3)

2. **Scale to production workloads**
   - Integrate with your CI/CD pipeline
   - Connect to issue trackers (Jira, GitHub Issues)
   - Add webhook-based triggering

3. **Monitor & optimize**
   - Track success rate & cost per ticket
   - Adjust role timeouts for your infrastructure
   - Collect feedback on patch quality

---

**Document version**: 1.0  
**Last updated**: 2026-07-30  
**Harness version**: Phase 1 (MVP with SQLite checkpointing)
