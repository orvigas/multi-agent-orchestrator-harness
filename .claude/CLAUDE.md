# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A reusable, stack-agnostic multi-agent harness built with LangGraph.js (TypeScript), implemented layer-by-layer from the how-to specs in `loops_prompts/01` through `07`. Each `loops_prompts/NN-*.md` is the design doc for one layer; they were written as a series and each one references decisions made in earlier ones. They are specs to implement against, not infallible ground truth — several contain real bugs or gaps that were found by actually running the code (see "Known gotchas" below) and fixed in the implementation rather than followed literally.

This project is not a git repository. Don't run git commands expecting them to work; there's no history to diff against.

## Codebase exploration: prefer codegraph

This repo has a `.codegraph/` index. Before grepping or reading files manually to understand a symbol, a call chain, or "where is X used/defined", use the `codegraph_*` MCP tools (`codegraph_explore` first — it usually answers "how does X work" or "where is X" in one call; `codegraph_search`/`codegraph_callers`/`codegraph_callees`/`codegraph_impact` for narrower questions). This matters especially here because the adapter pattern (see below) means a symbol's real call chain often crosses an `src/orchestrator/nodes/*.ts` adapter into a completely different `src/workflows/<layer>/` subgraph — codegraph traces that in one call where a grep would require guessing which layer to search next. Fall back to `Grep`/`Read` for things codegraph doesn't index well: prose in `.harness/*.md` or `loops_prompts/*.md`, and `config/*.yml` content.

## Setup

```bash
npm install
cp .env.example .env   # placeholder values are enough — see "Deterministic stand-ins" below
```

## Commands

```bash
npm run dev        # run the full Orchestrator across the demo backlog in src/index.ts
npm run typecheck  # tsc --noEmit
npx eslint .       # lint (flat config in eslint.config.js; not wired as an npm script — run directly)
npm test           # runs every *.test.ts file, explicitly listed in package.json's "test" script
```

Running a single test file: `npx tsx --test path/to/file.test.ts` (the `test` script just lists all of them explicitly — there's no glob). When adding a new `*.test.ts` file, add it to that list in `package.json` or it won't run in CI/`npm test`.

Per-layer standalone demos (each exercises one subgraph in isolation, independent of the full Orchestrator):

```bash
npm run kb:demo             # Knowledge Engine (Layer 2): explore-narrow evidence retrieval
npm run kb:index             # pre-warm/report the Knowledge Engine's structural + vector index
npm run planner:demo        # Planner (Layer 3): Discovery -> Planning -> Validation
npm run implementation:demo # Implementation Loop (Layer 4): patch generation + sandbox + quick-check
npm run validation:demo     # Validation Pipeline (Layer 5): fail-fast fan-out/fan-in tool pipeline
npm run recovery:demo       # Recovery Loop (Layer 6): diagnosis -> strategy -> targeted fix
```

## Architecture

### The layers

The Orchestrator (`src/orchestrator/graph.ts`) is the top-level LangGraph `StateGraph`. It processes a backlog of tickets one at a time, and for each ticket walks through five subgraphs, each living under `src/workflows/<layer>/` with its own `graph.ts`, `state.ts`, `types.ts`, and `nodes/`:

1. **Knowledge Engine** (`knowledge-engine/`) — real explore→narrow evidence retrieval: `ts-morph` for AST queries, `fs` for grep, TF-IDF/cosine similarity for a "vector" tier (no real embeddings). Loops narrowing its search until a verifier says the evidence is sufficient.
2. **Planner** (`planner/`) — Discovery → Planning → Validation, a plan-execute-verify loop with anti-fixation: a rejected plan is tagged `plan_error` (fix the plan) or `discovery_gap` (the *understanding* was wrong, go back to Discovery) so the loop doesn't just regenerate the same broken plan forever.
3. **Implementation Loop** (`implementation/`) — turns one `PlanTask` into a `Patch` (context-based hunks, never line numbers), applies it in a real sandboxed temp-directory copy of the repo (`tools/sandbox.ts`), and runs a cheap real quick-check (`tsc`/a single test) before handing off to Validation.
4. **Validation Pipeline** (`validation-pipeline/`) — deliberately has **no LLM anywhere**: `compile → tests → (lint ‖ static_analysis ‖ security) → performance`, fail-fast, real subprocesses (`tsc`, `eslint`, `npm test`, `npm audit`) via `tools/exec.ts`.
5. **Recovery Loop** (`recovery/`) — the one layer where interpretation is allowed: turns Layer 5's objective `failureCategory` into a deeper root-cause diagnosis, applies hard rules (Security always escalates; a repeated failure forces a strategy change, never a blind retry) before falling back to judgment, and produces a narrow `targetedFixTask` that gets substituted back into the plan — never "regenerate everything."

`loops_prompts/07-quality-gate-howto.md` (a review-driven loop that never touches code) is specified but not yet implemented.

### The adapter pattern (read this before touching `src/orchestrator/nodes/`)

Each subgraph above uses its **own** `Annotation.Root` state schema, different from `OrchestratorState`. Because of that, the Orchestrator can't just `addNode("planning", plannerWorkflow)` — LangGraph nodes registered that way expect the parent's schema. Instead, every layer has an adapter node in `src/orchestrator/nodes/` (`knowledgeEngine.ts`, `planner.ts`, `implementation.ts`, `recovery.ts`) that manually `.invoke()`s the subgraph and maps fields between the two schemas by hand. When adding a new subgraph, follow this pattern — don't try to share `OrchestratorState` across layers just to avoid writing an adapter.

`src/orchestrator/nodes/implementation.ts` is the most involved adapter: it iterates `plan.order` itself (the Orchestrator drives the per-task loop, not the Implementation subgraph), runs Implementation Loop *and* Validation Pipeline per task, and — after a Recovery pass — resumes at the failed task and substitutes in Recovery's narrow fix task rather than restarting the whole plan. That resume/substitution logic is extracted as the pure, independently-tested `resolveExecutionPlan` function in that same file.

### Deterministic stand-ins instead of real LLM calls

Every layer's LLM-calling roles (planner, discovery, implementer, recovery diagnostician, etc.) are implemented as **deterministic heuristics**, not real model calls — `resolveModelForRole` (`src/config/loadConfig.ts`) exists and is wired up, but nothing actually calls it. This is intentional throughout, not incomplete work: it keeps `npm run dev` and every demo reproducible and runnable with placeholder API keys. Where a heuristic stands in for real judgment, it's built from genuinely real signals where possible (e.g. Recovery's diagnosis re-classifies a compile failure as an "Architecture" root cause by actually scanning the failure text against `.harness/rules/forbidden-zones.md`'s real patterns, not a fake rule).

### Config loading

`config/*.yml` (one per layer) + `src/config/load*Config.ts` loaders. Every loader except `loadProvidersConfig` (which also validates env vars) is built from the shared `createYamlConfigLoader<T>` factory in `src/config/yamlConfigLoader.ts` — memoized per process. Add a new layer's config through that factory, not a hand-rolled copy. Note: `config/budgets.yml` is currently unused by any loader — Layer 1's default token/cost budgets are hardcoded directly in `src/orchestrator/state.ts` instead.

### `.harness/` — layered project context

`src/config/loadContext.ts` loads `.harness/{rules,architecture,governance}/*.md` with precedence: module-global → project (`.harness/` in `cwd`) → local (`.harness.local/`, gitignored, never committed). `buildContextBlock(kind)` concatenates a layer's files for injection into a node. Governance docs (`.harness/governance/*.md`) are the actual behavioral contracts for each layer (e.g. forbidden zones, budget caps, when Security must always escalate) — read the relevant one before changing a layer's policy logic, since the code is supposed to match it exactly.

### Sandboxing

This repo isn't a git repository, so "sandbox" doesn't mean `git worktree` (contra `loops_prompts/04`) — `src/workflows/implementation/tools/sandbox.ts` copies the whole repo into `os.tmpdir()` and symlinks `node_modules` in, cheaply. Sandboxes are cleaned up on success and deliberately left behind on failure/escalation for inspection (see `.harness/governance/implementation.md`). If you add a new file type real tools need in the sandbox (e.g. a new lint config), add it to `COPIED_ENTRIES` in that file — this has silently broken tool stages before (ESLint and `npm audit` both needed entries added after the fact).

### Known gotchas (already hit more than once — check for these before assuming new code is correct)

- **LangGraph forbids a node name that collides with a state channel name** in the same graph (e.g. a node called `"discovery"` next to a state field `discovery`) — pick a different node name (verb form, e.g. `"discover"`) if this happens.
- **Accumulating reducers can't be "reset" by returning `[]`** — `(prev, next) => prev.concat(next)` means `prev.concat([])` is just `prev`. Fields that need both accumulation *and* an explicit reset (e.g. `recoveryHistory`, `evidencePackage`) use a reducer that special-cases an empty array as a clear signal.
- **TypeScript widens literal-typed fields returned from ternaries/object literals** inside a node function's inferred return type, which then fails against LangGraph's channel types (e.g. `signal: string` instead of the literal union). Fix by annotating the variable or return type explicitly, not by loosening the state type.
- **Real subprocess tools need real setup**: `spawnSync` blocks Node's single thread — a graph's "parallel" fan-out (e.g. Validation Pipeline's lint/static_analysis/security) is only actually concurrent if the underlying tool call is async (`spawn`, not `spawnSync`).

### Testing philosophy

Tests use Node's built-in `node:test` runner (via `tsx --test`), not a separate framework. Where a layer wraps a real tool (compiler, linter, sandbox, `npm audit`), the tests invoke it for real (a temp sandbox, a real `tsc` run, a real timeout) rather than mocking — see `src/workflows/validation-pipeline/exec.test.ts` or `src/workflows/implementation/sandbox.test.ts` for the pattern.
