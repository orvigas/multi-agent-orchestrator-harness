# Archived Documentation

This directory contains historical documentation that has been consolidated into the main `README.md`.

## Why Archived?

- **QUICK_START.md.archived**: Content merged into `README.md` "Quick Start" section
- **IMPLEMENTATION_GUIDE.md.archived**: Content merged into `README.md` "Architecture", "Features", "Deployment" sections

Both documents were aspirational (described future state) rather than current state. The new `README.md` provides:
- ✅ Current state documentation
- ✅ Consolidated quick start (5 minutes)
- ✅ Real architecture diagram (8 layers, actual code)
- ✅ Production deployment guide
- ✅ Testing & troubleshooting

## When to Reference Archived Docs?

- **Historical context**: How we imagined the system would work
- **Feature planning**: What was planned but not yet implemented
- **Design rationale**: Original design docs (see also `loops_prompts/01-08/*.md`)

## Current Documentation Structure

```
README.md              ← Main entry point (all you need to get started)
PRODUCTION.md         ← Advanced deployment guide (referenced from README)
ARCHITECTURE_VISUAL.md ← Visual diagrams (referenced from README)
.claude/CLAUDE.md     ← Developer guide for Claude Code
loops_prompts/NN-*.md ← Original specifications
.harness/             ← Project context + governance
docs/phase*.md        ← Phase implementation details
```

---

**Consolidation Date**: 2026-07-30  
**Reason**: Single source of truth (README.md) reduces maintenance burden
