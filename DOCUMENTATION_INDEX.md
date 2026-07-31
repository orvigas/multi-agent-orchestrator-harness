# Documentation Index

Guía de dónde encontrar cada tipo de información en el repositorio.

---

## 🚀 Para Empezar Rápido

| Documento | Propósito | Tiempo |
|-----------|-----------|--------|
| **[GETTING_STARTED.md](docs/GETTING_STARTED.md)** | Setup completo desde 0 | 15-20 min |
| **[REQUIREMENTS_CAPTURE.md](docs/REQUIREMENTS_CAPTURE.md)** | Convertir requerimientos en tickets | 10 min |
| **[README.md](README.md)** | Visión general del proyecto | 5 min |

---

## 📚 Documentación Principal

### Arquitectura & Diseño

| Documento | Contenido |
|-----------|----------|
| **[STRUCTURE.md](STRUCTURE.md)** | Estructura de directorios: host vs harness |
| **[.claude/CLAUDE.md](.claude/CLAUDE.md)** | Arquitectura técnica detallada, adapter pattern, layers |
| **[ARCHITECTURE_VISUAL.md](ARCHITECTURE_VISUAL.md)** | Diagramas de la arquitectura |
| **[loops_prompts/](loops_prompts/)** | Especificaciones originales de cada capa (01-08) |

### Implementación & Fases

| Documento | Tema |
|-----------|------|
| **[docs/MULTI_LANGUAGE_SUPPORT.md](docs/MULTI_LANGUAGE_SUPPORT.md)** | Soporte multi-lenguaje (Phase 2) |
| **[docs/ADDING_LANGUAGE_SUPPORT.md](docs/ADDING_LANGUAGE_SUPPORT.md)** | Cómo agregar un nuevo lenguaje |
| **[docs/phase2-*.md](docs/)** | Implementación de features específicas |
| **[PRODUCTION.md](PRODUCTION.md)** | Deployment a producción |

### Contexto Compartido

| Directorio | Contenido |
|-----------|----------|
| **[.harness/rules/](.harness/rules/)** | Zonas prohibidas, restricciones |
| **[.harness/architecture/](.harness/architecture/)** | Patrones, ADRs, áreas sensibles |
| **[.harness/governance/](.harness/governance/)** | Políticas por capa, reglas duras |

---

## 🔍 Encontrar Información Por Tema

### Si quiero...

#### Setup & Instalación
→ `docs/GETTING_STARTED.md` (paso a paso)

#### Capturar requerimientos de usuarios
→ `docs/REQUIREMENTS_CAPTURE.md` (ejemplos, templates)

#### Crear un ticket
→ `docs/REQUIREMENTS_CAPTURE.md` (formato JSON, validación)

#### Ejecutar el harness
→ `README.md` Quick Start section

#### Entender la estructura
→ `STRUCTURE.md` (visual del proyecto)

#### Aprender la arquitectura
→ `.claude/CLAUDE.md` (layers, adapter pattern)

#### Agregar un nuevo lenguaje
→ `docs/ADDING_LANGUAGE_SUPPORT.md`

#### Deployar a producción
→ `PRODUCTION.md`

#### Entender cómo funciona una capa específica
→ `loops_prompts/0X-*.md` (diseño) + `harness/src/workflows/*/README.md` (implementación)

#### Ver políticas de seguridad
→ `.harness/governance/` (rules duras)

#### Troubleshoot un error
→ `docs/GETTING_STARTED.md#Troubleshooting` (common issues)

#### Ver el status del proyecto
→ `README.md` (Status & Roadmap section)

---

## 📂 Estructura de Documentos

```
.
├── README.md                     ← Start here
├── STRUCTURE.md                  ← Project layout
├── DOCUMENTATION_INDEX.md        ← This file
├── PRODUCTION.md                 ← Deployment guide
├── ARCHITECTURE_VISUAL.md        ← Architecture diagrams
│
├── .claude/
│   └── CLAUDE.md                ← Technical deep dive for developers
│
├── .harness/                     ← Shared context
│   ├── rules/                    ← Forbidden zones
│   ├── architecture/             ← Patterns & decisions
│   └── governance/               ← Policies per layer
│
├── docs/
│   ├── GETTING_STARTED.md       ← Setup from scratch
│   ├── REQUIREMENTS_CAPTURE.md  ← How to create tickets
│   ├── MULTI_LANGUAGE_SUPPORT.md
│   ├── ADDING_LANGUAGE_SUPPORT.md
│   ├── phase*.md                ← Phase-specific implementation
│   └── POLYGLOT_PROJECT_EXAMPLE.md
│
├── loops_prompts/
│   ├── 01-orchestrator-langgraph-howto.md
│   ├── 02-knowledge-engine-loop-howto.md
│   ├── 03-planner-loop-howto.md
│   ├── 04-implementation-loop-howto.md
│   ├── 05-validation-pipeline-howto.md
│   ├── 06-recovery-loop-howto.md
│   ├── 07-quality-gate-howto.md
│   └── 08-merge-manager-howto.md
│
└── harness/
    ├── README.md                ← Harness-specific info
    ├── src/
    │   ├── orchestrator/        ← Layer 0
    │   ├── workflows/           ← Layers 1-7
    │   └── ...
    └── config/                  ← YAML configuration
```

---

## 🎯 Reading Paths

### Path 1: Complete Beginner (wants to run harness)

1. `docs/GETTING_STARTED.md` — Setup
2. `docs/REQUIREMENTS_CAPTURE.md` — Create first ticket
3. `README.md` — Overview
4. `STRUCTURE.md` — Understand layout
5. `.claude/CLAUDE.md` — Deep dive (optional)

**Estimated time:** 1-2 hours

### Path 2: Developer (wants to understand architecture)

1. `STRUCTURE.md` — Project layout
2. `.claude/CLAUDE.md` — Architecture details
3. `ARCHITECTURE_VISUAL.md` — Diagrams
4. `loops_prompts/` — Design specs (pick layers of interest)
5. `harness/src/workflows/*/` — Implementation

**Estimated time:** 3-4 hours

### Path 3: Operator (wants to deploy & monitor)

1. `PRODUCTION.md` — Deployment guide
2. `README.md` — Quick start
3. `.harness/governance/` — Policies
4. `docs/GETTING_STARTED.md#Troubleshooting` — Issues

**Estimated time:** 1-2 hours

### Path 4: Contributor (wants to add language support)

1. `docs/ADDING_LANGUAGE_SUPPORT.md` — Walkthrough
2. `docs/MULTI_LANGUAGE_SUPPORT.md` — Current state
3. `harness/src/parsers/` — Look at existing parsers
4. `.harness/architecture/` — Patterns to follow
5. Submit PR

**Estimated time:** 4-6 hours

---

## 🔑 Key Concepts Explained

### Harness
- **What:** Multi-agent LLM-driven orchestrator for code modification
- **Where:** `harness/` directory (independent, removable)
- **How:** Processes tickets → Knowledge Engine → Planner → Implementation → Validation → Recovery → Quality Gate → Merge Manager

### Host Repository
- **What:** The target codebase being analyzed and modified
- **Where:** Outside the harness (can be any repository)
- **How:** Copied to sandbox, patches applied, results tested

### Layers (Capas)
1. **Orchestrator** — Main coordinator (LangGraph StateGraph)
2. **Knowledge Engine** — Evidence retrieval (AST + grep + TF-IDF)
3. **Planner** — Discovery → Planning → Validation loop
4. **Implementation** — Patch generation + sandbox
5. **Validation Pipeline** — Real tool execution (tsc, tests, lint)
6. **Recovery** — Diagnosis + strategy selection
7. **Quality Gate** — Metrics review
8. **Merge Manager** — Conflict resolution + merge

### Shared Context (.harness/)
- **What:** Governance, architecture, rules shared between harness and host
- **Format:** Markdown files in `.harness/rules/`, `.harness/architecture/`, `.harness/governance/`
- **Purpose:** Guide decisions, enforce constraints, document policies

### Ticket
- **What:** Unit of work (bug fix, feature, refactoring)
- **Format:** JSON with ticketId, title, requirements, etc.
- **Flow:** Created in `backlog.json` → Processed by orchestrator → Result

### Checkpoint
- **What:** Saved state of harness execution
- **Storage:** SQLite database (`.harness-checkpoints.db`)
- **Purpose:** Resume interrupted runs, track progress

---

## 🔗 Cross-References

### By Capa

**Capa 0 (Orchestrator):**
- Design: `loops_prompts/01-orchestrator-langgraph-howto.md`
- Implementation: `harness/src/orchestrator/`
- Tests: `harness/src/orchestrator/*.test.ts`

**Capa 1 (Knowledge Engine):**
- Design: `loops_prompts/02-knowledge-engine-loop-howto.md`
- Implementation: `harness/src/workflows/knowledge-engine/`
- Policy: `.harness/governance/knowledge-engine.md`

(Same pattern for Capas 2-7)

### By Feature

**Multi-Language Support:**
- Implementation: `docs/MULTI_LANGUAGE_SUPPORT.md`
- How to add: `docs/ADDING_LANGUAGE_SUPPORT.md`
- Code: `harness/src/parsers/`, `src/parsers/`

**Token Budget & Cost Control:**
- Phase doc: `docs/phase3-token-budget-enforcement.md`
- Implementation: `harness/src/services/tokenBudgetEnforcer.ts`
- Policy: `.harness/governance/orchestrator.md`

**Production Deployment:**
- Guide: `PRODUCTION.md`
- Docker: `harness/Dockerfile` (see README.md)
- GitHub Actions: `.github/workflows/` (see README.md)

---

## 📊 Documentation Statistics

| Category | Count | Total Size |
|----------|-------|-----------|
| Guide docs | 5 | ~50 KB |
| Architecture | 3 | ~20 KB |
| Implementation (loops_prompts) | 8 | ~80 KB |
| Policy (.harness/) | 8 | ~40 KB |
| **Total** | **24+** | **~190 KB** |

---

## 🔄 Documentation Maintenance

- **Last Updated:** 2026-07-30
- **Maintained by:** Project team
- **Update Frequency:** With each major phase
- **How to contribute:** Submit PR with docs changes

### Keep Current

After making code changes, update:
1. The relevant `loops_prompts/0X-*.md` if architecture changed
2. `.claude/CLAUDE.md` if overall structure changed
3. `docs/phase-*.md` if feature was added
4. `.harness/governance/*.md` if policies changed

---

## ❓ FAQ

**Q: Where do I find API documentation?**  
A: Not written separately. See `harness/src/**/*.ts` for types, interfaces. Codegraph has symbol lookups.

**Q: How do I update the architecture?**  
A: Update `.claude/CLAUDE.md` and relevant `loops_prompts/*.md` file.

**Q: Where are breaking changes documented?**  
A: In `docs/phase*.md` and release notes (TBD).

**Q: Can I use this with my own repo?**  
A: Yes! See `docs/GETTING_STARTED.md` — it's designed to work with any repo.

---

**Need help?** Start with `docs/GETTING_STARTED.md` or read the issue-specific guide above.

