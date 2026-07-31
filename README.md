# Multi-Agent Orchestrator Harness

**A production-ready, stack-agnostic multi-agent harness built with LangGraph.js (TypeScript)**

Automated intelligent code modification across entire codebases using real Claude API calls, complete validation pipeline, intelligent recovery strategies, and human-in-the-loop quality gates.

> **Note**: This harness is designed to work with **any target repository**. The harness itself is completely decoupled and lives in its own `harness/` directory.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue)](https://www.typescriptlang.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2.44+-purple)](https://github.com/langchain-ai/langgraph)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Persistent-brightgreen)](https://www.sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-246%20passing-brightgreen)](#test-results)

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
```bash
node --version  # Must be v18+
```

### Installation

**Step 1: Set up the harness**
```bash
cd harness
npm install
cp .env.example .env
# Edit .env with your API keys (ANTHROPIC_API_KEY, etc.)
```

**Step 2: Run the orchestrator**
```bash
# Deterministic mode (no LLM calls, reproducible, for testing)
npm run dev

# LLM mode (real Claude API, for production)
HARNESS_MODE=llm npm run dev
```

### Example: Process a Single Ticket

Create a `harness/backlog.json`:
```json
[
  {
    "ticketId": "TASK-1",
    "title": "Add email validation to LoginService",
    "description": "Users report login failures after restart",
    "targetRepoPath": "/path/to/target-repo",
    "requirements": "..."
  }
]
```

Then run:
```bash
cd harness
npm run dev  # Processes backlog.json
```

---

## 📋 Architecture Overview

### 8-Layer Orchestrator

```
Layer 1: Orchestrator (LangGraph StateGraph)
├─ Layer 2: Knowledge Engine (evidence retrieval: AST + TF-IDF + grep)
├─ Layer 3: Planner (Discovery → Planning → Validation loop)
├─ Layer 4: Implementation Loop (patch generation + sandbox + quick-check)
├─ Layer 5: Validation Pipeline (compile → tests → lint → static analysis → security)
├─ Layer 6: Recovery Loop (diagnosis → strategy → targeted fix)
├─ Layer 7: Quality Gate (coverage, architecture, sonar checks)
└─ Layer 8: Merge Manager (conflict detection → merge → close ticket)
```

Each layer is a **LangGraph subgraph** with:
- `state.ts` — State schema (Annotation.Root)
- `graph.ts` — Subgraph definition
- `nodes/` — Individual decision/execution nodes
- `types.ts` — Type definitions
- `<layer>.test.ts` — Unit + integration tests

### Execution Flow for One Ticket

```
Ticket: "Add email validation to LoginService"
  ↓
[Knowledge Engine] Search codebase
  → Evidence: LoginService.ts, LoginService.test.ts, auth rules, .harness/rules
  ↓
[Planner] Analyze ticket + evidence
  → Discovery: Problems, dependencies, risks
  → Planning: Ordered tasks (UpdateService → AddTests → UpdateIntegration)
  → Validation: Is plan sound? (retry if not)
  ↓
[Implementation] Generate + apply patches per task
  → For each task:
    • Generate patch (via LLM or heuristic)
    • Apply in sandbox (real copy of repo)
    • Quick-check (compile + 1 test)
  ↓
[Validation Pipeline] Fail-fast real tool execution
  • Compile (tsc)
  • Tests (npm test)
  • Lint (eslint)
  • Static Analysis (stricter tsc)
  • Security (npm audit)
  ↓
[Recovery] If validation fails
  → Diagnose root cause (Compilation, Tests, Architecture, etc.)
  → Decide strategy (retry, change_context, change_model, abort)
  → Apply targeted fix if strategy allows
  ↓
[Quality Gate] Human-checkable metrics
  • Code coverage delta
  • Architecture violations
  • Sonar quality metrics
  ↓
[Merge Manager] Finalize
  • Detect conflicts
  • Merge to target branch
  • Close ticket
```

---

## 🛠️ Key Features

### ✅ Production-Ready Deployment

- **SQLite Checkpointing**: Persist state between runs (configurable to PostgreSQL)
- **Target Repository Decoupling**: Operate on any repo via `--target /path`
- **Docker-Ready**: Containerized execution with volume mounts
- **LLM Mode Configuration**: Toggle between deterministic (testing) and LLM (production)

### ✅ Resilient LLM Integration

- **Multi-Provider Fallback**: Anthropic → OpenAI → OpenRouter
- **Circuit Breaker**: Prevents cascading failures (open circuit after 5 failures)
- **Adaptive Backoff**: Exponential backoff with jitter, learns from failure patterns
- **Per-Role Timeouts**: Discovery (45s), Planner (60s), Implementer (45s), etc.
- **Token Budget Enforcement**: Global 200K token limit + cost tracking ($5 USD limit)
- **Intelligent Model Downgrade**: When budget tight, try cheaper models (Opus → Sonnet → Haiku)

### ✅ Safety & Validation

**4-Level Patch Safety Pipeline**:
1. Structure validation (hunks present, fields correct)
2. Format validation (JSON parseable, arrays/strings correct)
3. Forbidden zones (no modifications to restricted directories per `.harness/rules/`)
4. Sanity checks (context lines exist, oldLines/newLines non-empty)

**Real Tool Execution** (not mocked):
- TypeScript compiler (tsc)
- Unit tests (npm test)
- Linting (eslint)
- Security audit (npm audit)
- Code coverage measurement

### ✅ Intelligent Recovery

- **Root Cause Diagnosis**: Analyzes failure evidence + history
- **Strategy Selection**: Retry → Change Planning → Change Model → Abort
- **Anti-Fixation Rules**: 
  - Repeated failures force strategy change, never blind retry
  - Security issues always escalate
  - MergeConflicts never autofix

### ✅ Observable & Debuggable

- **Comprehensive Logging**: Every decision logged with reasoning
- **Token Tracking**: Per-layer, per-role token usage
- **Cost Estimation**: Real-time USD cost calculation
- **LangSmith Integration**: Optional (set `LANGCHAIN_TRACING_V2=true`)
- **Decision Logs**: Full decision trail per ticket

---

## 📦 Environment Setup

### Create `.env` from template
```bash
cp .env.production .env
```

### Configure API Keys
```bash
# Required for HARNESS_MODE=llm
ANTHROPIC_API_KEY=sk-ant-v0-...
OPENAI_API_KEY=sk-...                    # Optional fallback
OPENROUTER_API_KEY=sk-or-...            # Optional proxy

# Database
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db

# Mode (default: deterministic)
HARNESS_MODE=llm                         # or "deterministic"

# Optional: Observability
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
```

### Validate Configuration
```bash
npm run dev -- --dry-run  # Validate without executing
```

---

## 🔧 Commands

**All commands run from `harness/` directory:**

```bash
cd harness
```

### Development

```bash
npm run dev              # Run full orchestrator
npm run typecheck        # TypeScript validation
npm run typecheck -- --noEmit  # Strict type check
npm test                 # Run all tests
```

### Per-Layer Standalone Demos

```bash
npm run kb:demo             # Knowledge Engine standalone
npm run planner:demo        # Planner standalone
npm run implementation:demo # Implementation Loop
npm run validation:demo     # Validation Pipeline
npm run recovery:demo       # Recovery Loop
npm run quality-gate:demo   # Quality Gate
npm run merge-manager:demo  # Merge Manager
npm run kb:index            # Pre-warm Knowledge Engine index
```

### Production Operations

```bash
npm run execute          # Main orchestrator execution
npm run logs             # View execution logs
npm run costs            # View token usage & costs
```

---

## 🏗️ Project Structure

```
.
├── src/                        # TARGET REPOSITORY (parsers, validators, test-runners, etc.)
│   ├── build-systems/          # Compiler/build integration
│   ├── languages/              # Language detection
│   ├── parsers/                # Code parsers (Java, Python, Go, Rust, etc.)
│   ├── validators/             # Code validators
│   ├── test-runners/           # Test execution engines
│   ├── persistence/            # Data persistence layer
│   ├── utils/                  # Utility functions
│   └── services/               # Host-specific services
│
├── harness/                    # 🚀 INDEPENDENT HARNESS (self-contained, removable)
│   ├── src/
│   │   ├── orchestrator/           # Layer 0: Main orchestrator
│   │   │   ├── graph.ts           # State graph definition
│   │   │   ├── state.ts           # OrchestratorState schema
│   │   │   └── nodes/             # Adapter nodes (invoke subgraphs)
│   │   │
│   │   ├── workflows/              # Layers 1-8: Individual subgraphs
│   │   │   ├── knowledge-engine/  # Layer 1: Evidence retrieval
│   │   │   ├── planner/           # Layer 2: Planning
│   │   │   ├── implementation/    # Layer 3: Patch generation
│   │   │   ├── validation-pipeline/ # Layer 4: Real tools
│   │   │   ├── recovery/          # Layer 5: Failure recovery
│   │   │   ├── quality-gate/      # Layer 6: Quality checks
│   │   │   └── merge-manager/     # Layer 7: Merge + close
│   │   │
│   │   ├── services/               # Harness services
│   │   │   ├── llm.ts             # LLM call wrapper
│   │   │   ├── llmCircuitBreaker.ts
│   │   │   ├── tokenBudgetEnforcer.ts
│   │   │   └── modelDowngradeStrategy.ts
│   │   │
│   │   ├── config/                 # Config loaders
│   │   │   ├── loadContext.ts      # Load .harness/ (shared context)
│   │   │   └── load*.ts            # Load YAML configs
│   │   │
│   │   ├── index.ts               # Harness entry point
│   │   └── *.test.ts              # Tests
│   │
│   ├── config/                      # YAML configuration (harness-specific)
│   │   ├── orchestrator.yml         # Layer 0 config
│   │   ├── knowledge-engine.yml
│   │   ├── planner.yml
│   │   ├── providers.yml            # LLM providers (Anthropic, OpenAI, etc.)
│   │   └── ...
│   │
│   ├── package.json                 # Harness dependencies (independent)
│   ├── tsconfig.json                # TypeScript config (independent)
│   ├── .env.example                 # Environment template
│   ├── .env                         # Actual config (gitignored)
│   ├── README.md                    # Harness documentation
│   └── .gitignore                   # Harness .gitignore
│
├── .harness/                        # ✅ SHARED CONTEXT (rules, architecture, governance)
│   ├── rules/                       # Forbidden zones, coding style
│   ├── architecture/                # ADRs, patterns, performance notes
│   └── governance/                  # Policy docs per layer
│
├── .codegraph/                      # Code intelligence index (shared)
├── .claude/                         # Claude Code config (shared)
│
├── docs/                            # Documentation
│   ├── GETTING_STARTED.md           # Setup guide for new projects
│   ├── REQUIREMENTS_CAPTURE.md      # How to capture & create tickets
│   ├── phase2-1-patch-safety.md
│   └── ...
│
├── loops_prompts/                   # Original design specs (01-08)
├── STRUCTURE.md                     # Project structure explanation
├── PRODUCTION.md                    # Production deployment guide
│
├── package.json                     # Host dependencies (minimal)
├── tsconfig.json                    # Host TypeScript config
└── README.md (this file)             # Main documentation
```

---

## 🧪 Testing

### Test Coverage

```
Total: 246 tests passing (100% pass rate)

Breakdown:
├─ E2E Production Tests (17 tests) — Full infrastructure validation
├─ Service Tests (50+ tests) — LLM, circuit breaker, timeout, budget
├─ Workflow Tests (150+ tests) — Each layer's routing + nodes
└─ Config Tests (20+ tests) — Config loading + validation
```

### Run Tests

```bash
# All tests
npm test

# Single file
npx tsx --test src/workflows/planner/nodes/planning.test.ts

# Watch mode (requires tsx enhancements)
npm test -- --watch
```

---

## 🚀 Deployment

All deployment commands run from `harness/` directory.

### Local Development (Harness)

```bash
cd harness

# Deterministic mode (fast, reproducible, no LLM costs)
npm run dev

# LLM mode (real Claude API)
HARNESS_MODE=llm npm run dev
```

### Docker Deployment

Create `harness/Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
ENV HARNESS_MODE=llm
CMD ["npm", "run", "execute"]
```

Build & run:
```bash
cd harness
docker build -t orchestrator:latest .
docker run -e ANTHROPIC_API_KEY=sk-ant-v0-... \
           -v /path/to/config:/app/config \
           -v ./data:/app/data \
           orchestrator:latest
```

### GitHub Actions

```yaml
name: Orchestrator
on: workflow_dispatch

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install harness dependencies
        run: cd harness && npm ci
      
      - name: Type check
        run: cd harness && npm run typecheck
      
      - name: Run orchestrator
        run: cd harness && HARNESS_MODE=llm npm run execute
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 📊 Performance & Scalability

### Single Instance (MVP)
- **Throughput**: 1-3 tickets/hour (depends on code complexity)
- **Memory**: 200-500 MB
- **Database**: <10 MB per 1000 checkpoints (SQLite)
- **Latency**: 5-15 min per ticket (end-to-end)

### Scaling Path
1. **Phase 1.3**: PostgreSQL checkpointer (multi-process support)
2. **Phase 2**: Queue-based processing (Temporal, Bull, RabbitMQ)
3. **Phase 3**: Knowledge Engine vector caching (Redis)
4. **Phase 4**: Distributed LLM caching (batch processing)

---

## 🔐 Security & Safety

### Hard Rules (Never Bypassed)

- **Forbidden Zones**: Directories/files marked in `.harness/rules/forbidden-zones.md` cannot be modified
- **Security Escalation**: Any security issue (`npm audit` warning) escalates without autofix
- **MergeConflict Escalation**: Conflicts never autofix (external state changed)
- **Token Budget**: Hard limit at 200K tokens, aborts if exceeded

### Soft Rules (Configurable)

- Per-role timeouts (adjustable in `config/providers.yml`)
- Circuit breaker failure threshold (default: 5)
- Model downgrade trigger (default: ≥80% budget)
- Recovery iteration limit (default: 3)

See `.harness/governance/` for complete policy docs.

---

## 🐛 Troubleshooting

### Missing API Key
```
Error: Falta la variable de entorno ANTHROPIC_API_KEY
```
**Solution**: Add to `.env` or CI/CD secrets

### SQLite Database Locked
```
Error: SQLITE_BUSY: database is locked
```
**Solution**: Ensure only one orchestrator instance runs. Use PostgreSQL for concurrent access.

### Timeout on LLM Call
```
Error: LLMTimeoutError: Anthropic timeout after 30000ms
```
**Solution**: Increase role-specific timeout in `config/providers.yml`

### Patch Validation Failed
```
LLM patch rejected by safety validation: Hunk 0: contextBefore is empty
```
**Solution**: LLM generated invalid patch. Recovery loop will retry or escalate.

---

## 🎓 Learning Resources

### Getting Started
- **`harness/SETUP.md`** — Complete setup guide (wizard & manual)
- **`harness/PRODUCT_OWNER.md`** — Product Owner Agent (ticket creation, LLM config, tests)
- **`harness/README.md`** — Harness overview & architecture

### Deep Dives
- **`.claude/CLAUDE.md`** — Technical deep dive for developers
- **`docs/IMPLEMENTATION_PHASES.md`** — Index of all phases (1-5) with links
- **`loops_prompts/01-08/*.md`** — Original layer specifications
- **`.harness/governance/*.md`** — Policy & behavioral contracts

### Reference
- **`STRUCTURE.md`** — Project structure explanation
- **`PRODUCTION.md`** — Production deployment guide
- **`src/**/*.test.ts`** — Runnable examples

---

## 📈 Status & Roadmap

### ✅ Current Status (2026-07-30)

- **Phase 1**: Production Ready ✅
  - Target repo decoupling, SQLite checkpointer, LLM infrastructure
  
- **Phase 2.x**: LLM Prompt Optimization ✅
  - 7 prompt fixes, 10-30% faster convergence, decision trees

- **Phase 3-5**: Infrastructure Complete ✅
  - Token budgeting, intelligent downgrade, E2E integration tests

### 🔄 Next Phases

- **Phase 1.3**: PostgreSQL Migration (multi-process)
- **Phase 6**: Real E2E Tests (public repos)
- **Phase 7**: Quality Gate Review Loop (human-in-the-loop)
- **Phase 8**: Merge Manager (conflict resolution)

---

## 📄 License & Attribution

Built with:
- **LangGraph.js** — Multi-agent orchestration framework
- **TypeScript** — Type-safe implementation
- **Claude API** — Intelligent decision making
- **Node.js** — Runtime

---

## 🤝 Contributing

This is an experimental multi-agent harness. Contributions, feedback, and forks are welcome.

See `.claude/CLAUDE.md` for development guidelines.

---

## 📞 Support

- **Issues & Bugs**: Check `.harness/` for governance policies
- **Documentation**: Read `loops_prompts/` for specifications
- **Configuration**: See `config/` yaml files for defaults
- **Debugging**: Enable `LANGCHAIN_TRACING_V2=true` for observability

---

**Last Updated**: 2026-07-30  
**Version**: Phase 1 + Phase 2.x (Production-Ready + Optimized)  
**Test Status**: 246 tests passing ✅
