# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is a **two-part repository**:

1. **Host project** (this directory) — Target repository containing multi-language code parsers, validators, and test runners (`src/build-systems/`, `src/languages/`, `src/parsers/`, `src/validators/`, `src/test-runners/`, etc.)
2. **Harness** (`harness/` subdirectory) — A reusable, stack-agnostic multi-agent system built with LangGraph.js (TypeScript), independent and removable without affecting the host.

The harness is a complete, self-contained system with its own:
- Dependencies (`harness/package.json`)
- Configuration (`harness/config/`, `harness/.env`)
- LangGraph workflows (`harness/src/orchestrator/`, `harness/src/workflows/`)

The **only shared resource** is `.harness/` — context files (rules, architecture, governance) that both the host and harness can reference.

This project is a git repository. Git commands (log, diff, add, commit, push) work as expected.

## Project Structure

```
.
├── .claude/                 # Claude Code configuration (shared)
├── .codegraph/              # Code intelligence index (shared)
├── .harness/                # Shared context files (rules, architecture, governance)
├── src/                     # Host project code
│   ├── build-systems/       # Build system parsers
│   ├── languages/           # Language detection
│   ├── parsers/             # Code parsers (Java, Python, Go, Rust, etc.)
│   ├── validators/          # Code validators
│   ├── test-runners/        # Test execution
│   ├── persistence/         # Data persistence
│   ├── utils/               # Utilities
│   └── services/            # Host services (separate from harness services)
├── harness/                 # INDEPENDENT harness (can be removed without affecting host)
│   ├── src/
│   │   ├── orchestrator/    # Capa 0: Main orchestrator
│   │   ├── workflows/       # Capas 1-7: Knowledge Engine, Planner, Implementation, etc.
│   │   ├── services/        # Harness-specific services (LLM, token tracking, etc.)
│   │   ├── config/          # Config loaders
│   │   └── index.ts         # Harness entry point
│   ├── config/              # YAML configuration (independent)
│   ├── package.json         # Harness dependencies (independent)
│   ├── tsconfig.json        # TypeScript config (independent)
│   └── .env.example         # Environment variables template
└── package.json             # Host project dependencies
```

## Setup & Getting Started

### For New Users

**Complete setup guide:** See `docs/GETTING_STARTED.md` for:
- Environment setup (Node.js, API keys)
- Configuration (.env, .harness/)
- Running first test
- Troubleshooting

**From 0 to first ticket:** ~15-20 minutes following that guide.

### Quick Setup (if you already have the code)

**Host project:**
```bash
npm install
```

**Harness (independent, in harness/ directory):**
```bash
cd harness
npm install
cp .env.example .env   # Configure with API keys
cd ..
```

### Running

```bash
cd harness

# Deterministic mode (no API calls, testing)
npm run dev

# LLM mode (real Claude API)
HARNESS_MODE=llm npm run dev
```

## Commands

**Host project:**
```bash
npm run typecheck  # Type-check host code
npm run test       # Run host tests
npm test:parsers   # Test language parsers
npm test:validators # Test code validators
```

**Harness (from `harness/` directory):**
```bash
npm run dev             # Run the full Orchestrator
npm run typecheck       # Type-check harness
npm test                # Run harness tests
npm run kb:demo         # Knowledge Engine demo
npm run planner:demo    # Planner demo
npm run implementation:demo
npm run validation:demo
npm run recovery:demo
```

## Codebase exploration: prefer codegraph

This repo has a `.codegraph/` index shared between host and harness. 

For **harness code**: Before grepping manually, use `codegraph_*` MCP tools. The adapter pattern (see below) means a symbol's call chain often crosses `harness/src/orchestrator/nodes/*.ts` into a different `harness/src/workflows/<layer>/` subgraph — codegraph traces this in one call.

For **context files** (which are shared): Fall back to grep/Read for `.harness/*.md` prose.

## Workflow: From Requirements to Execution

### Step 1: Capture Requirements

See `docs/REQUIREMENTS_CAPTURE.md` for how to convert user stories into structured tickets.

### Step 2: Create Tickets

Format: JSON with `ticketId`, `title`, `description`, `requirements`, etc.

Example:
```json
{
  "ticketId": "BUG-1",
  "title": "Fix email validation",
  "description": "Email validation rejects valid addresses",
  "targetRepoPath": "/path/to/repo",
  "requirements": "Update email regex in LoginService.ts to RFC 5322 spec"
}
```

### Step 3: Add to Backlog

Create `harness/backlog.json`:
```json
{
  "tickets": [
    { "ticketId": "BUG-1", ... },
    { "ticketId": "FEAT-1", ... }
  ]
}
```

### Step 4: Execute

```bash
cd harness
npm run dev                    # Deterministic mode
# or
HARNESS_MODE=llm npm run dev  # LLM mode (with Claude)
```

### Step 5: Monitor & Interpret

```bash
npm run logs   # View decision trail
npm run costs  # View token usage (LLM mode)
```

For detailed walkthrough: See `docs/REQUIREMENTS_CAPTURE.md`.

## Architecture

This section documents the **harness** structure (in `harness/`). The host project structure is independent.

### The layers

The Orchestrator (`harness/src/orchestrator/graph.ts`) is the top-level LangGraph `StateGraph`. It processes a backlog of tickets one at a time, and for each ticket walks through seven subgraphs, each living under `harness/src/workflows/<layer>/` with its own `graph.ts`, `state.ts`, `types.ts`, and `nodes/`:

1. **Knowledge Engine** (`knowledge-engine/`) — real explore→narrow evidence retrieval: `ts-morph` for AST queries, `fs` for grep, TF-IDF/cosine similarity for a "vector" tier (no real embeddings). Loops narrowing its search until a verifier says the evidence is sufficient.
2. **Planner** (`planner/`) — Discovery → Planning → Validation, a plan-execute-verify loop with anti-fixation: a rejected plan is tagged `plan_error` (fix the plan) or `discovery_gap` (the *understanding* was wrong, go back to Discovery) so the loop doesn't just regenerate the same broken plan forever.
3. **Implementation Loop** (`implementation/`) — turns one `PlanTask` into a `Patch` (context-based hunks, never line numbers), applies it in a real sandboxed temp-directory copy of the repo (`tools/sandbox.ts`), and runs a cheap real quick-check (`tsc`/a single test) before handing off to Validation.
4. **Validation Pipeline** (`validation-pipeline/`) — deliberately has **no LLM anywhere**: `compile → tests → (lint ‖ static_analysis ‖ security) → performance`, fail-fast, real subprocesses (`tsc`, `eslint`, `npm test`, `npm audit`) via `tools/exec.ts`.
5. **Recovery Loop** (`recovery/`) — the one layer where interpretation is allowed: turns Layer 5's objective `failureCategory` into a deeper root-cause diagnosis, applies hard rules (Security always escalates; a repeated failure forces a strategy change, never a blind retry) before falling back to judgment, and produces a narrow `targetedFixTask` that gets substituted back into the plan — never "regenerate everything."
6. **Quality Gate** (`quality-gate/`) — implemented (Phase 1), checks coverage, architecture, and gates code to merge manager. It's a review-gate (human-checkable metrics), not an LLM layer.
7. **Merge Manager** (`merge-manager/`) — orchestrates the merge to the target repository, handles conflicts, and manages release notes.

### The adapter pattern (read this before touching `harness/src/orchestrator/nodes/`)

Each subgraph above uses its **own** `Annotation.Root` state schema, different from `OrchestratorState`. Because of that, the Orchestrator can't just `addNode("planning", plannerWorkflow)` — LangGraph nodes registered that way expect the parent's schema. Instead, every layer has an adapter node in `harness/src/orchestrator/nodes/` (`knowledgeEngine.ts`, `planner.ts`, `implementation.ts`, `recovery.ts`) that manually `.invoke()`s the subgraph and maps fields between the two schemas by hand. When adding a new subgraph, follow this pattern — don't try to share `OrchestratorState` across layers just to avoid writing an adapter.

`harness/src/orchestrator/nodes/implementation.ts` is the most involved adapter: it iterates `plan.order` itself (the Orchestrator drives the per-task loop, not the Implementation subgraph), runs Implementation Loop *and* Validation Pipeline per task, and — after a Recovery pass — resumes at the failed task and substitutes in Recovery's narrow fix task rather than restarting the whole plan. That resume/substitution logic is extracted as the pure, independently-tested `resolveExecutionPlan` function in that same file.

### Deterministic stand-ins instead of real LLM calls

Every layer's LLM-calling roles (planner, discovery, implementer, recovery diagnostician, etc.) are implemented as **deterministic heuristics**, not real model calls — `resolveModelForRole` (`harness/src/config/loadConfig.ts`) exists and is wired up, but nothing actually calls it. This is intentional throughout, not incomplete work: it keeps `npm run dev` and every demo reproducible and runnable with placeholder API keys. Where a heuristic stands in for real judgment, it's built from genuinely real signals where possible (e.g. Recovery's diagnosis re-classifies a compile failure as an "Architecture" root cause by actually scanning the failure text against `.harness/rules/forbidden-zones.md`'s real patterns, not a fake rule).

### Config loading (harness)

`harness/config/*.yml` (one per layer) + `harness/src/config/load*Config.ts` loaders. Every loader except `loadProvidersConfig` (which also validates env vars) is built from the shared `createYamlConfigLoader<T>` factory in `harness/src/config/yamlConfigLoader.ts` — memoized per process. Add a new layer's config through that factory, not a hand-rolled copy. `harness/config/orchestrator.yml` (`loadOrchestratorConfig.ts`) holds Layer 1's own budgets/deadline defaults, consumed by `harness/src/orchestrator/state.ts` and `harness/src/index.ts` — note its config interface is deliberately named `OrchestratorRuntimeConfig`, not `OrchestratorConfig`, to avoid colliding with `loadConfig.ts`'s existing `OrchestratorConfig` (providers+roles, threaded through `state.config`). `loadProvidersConfig` also composes a single merged role registry from every layer's own `roles:` block (`planner.yml`, `knowledge-engine.yml`, etc.) — `providers.yml` itself only declares the `orchestrator` role plus the raw provider/apiKeyEnv map; see `harness/src/config/roles.test.ts` for the validation that catches a role pointing at an undeclared provider.

### `.harness/` — shared context

**Note:** `.harness/` is **shared between host and harness** — both can read from it.

`harness/src/config/loadContext.ts` searches for `.harness/{rules,architecture,governance}/*.md` by walking **up** from the current working directory to find the project root. `buildContextBlock(kind)` concatenates those files for injection into a node. Governance docs (`.harness/governance/*.md`) are the actual behavioral contracts for each layer (e.g. forbidden zones, budget caps, when Security must always escalate) — read the relevant one before changing a layer's policy logic, since the code is supposed to match it exactly.

### Sandboxing

The harness's Implementation Loop creates sandboxes by copying the host repository into `os.tmpdir()` and symlinking `node_modules`, cheaply. Sandboxes are cleaned up on success and deliberately left behind on failure/escalation for inspection (see `.harness/governance/implementation.md`). If you add a new file type real tools need in the sandbox (e.g. a new lint config), add it to `COPIED_ENTRIES` in `harness/src/workflows/implementation/tools/sandbox.ts` — this has silently broken tool stages before (ESLint and `npm audit` both needed entries added after the fact).

### Known gotchas (already hit more than once — check for these before assuming new code is correct)

- **LangGraph forbids a node name that collides with a state channel name** in the same graph (e.g. a node called `"discovery"` next to a state field `discovery`) — pick a different node name (verb form, e.g. `"discover"`) if this happens.
- **Accumulating reducers can't be "reset" by returning `[]`** — `(prev, next) => prev.concat(next)` means `prev.concat([])` is just `prev`. Fields that need both accumulation *and* an explicit reset (e.g. `recoveryHistory`, `evidencePackage`) use a reducer that special-cases an empty array as a clear signal.
- **TypeScript widens literal-typed fields returned from ternaries/object literals** inside a node function's inferred return type, which then fails against LangGraph's channel types (e.g. `signal: string` instead of the literal union). Fix by annotating the variable or return type explicitly, not by loosening the state type.
- **Real subprocess tools need real setup**: `spawnSync` blocks Node's single thread — a graph's "parallel" fan-out (e.g. Validation Pipeline's lint/static_analysis/security) is only actually concurrent if the underlying tool call is async (`spawn`, not `spawnSync`).

### Testing philosophy (harness)

Tests use Node's built-in `node:test` runner (via `tsx --test`), not a separate framework. Where a layer wraps a real tool (compiler, linter, sandbox, `npm audit`), the tests invoke it for real (a temp sandbox, a real `tsc` run, a real timeout) rather than mocking — see `harness/src/workflows/validation-pipeline/exec.test.ts` or `harness/src/workflows/implementation/sandbox.test.ts` for the pattern.
