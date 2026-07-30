# Rutas sensibles a performance

Rutas que, si un patch las toca, ameritan correr la etapa `performance` de la
Validation Pipeline (Capa 5) aunque `task.riskLevel` sea "low" — ver
`.harness/governance/validation-pipeline.md`.

Ninguna ruta identificada todavía en este proyecto. Candidatas naturales a
futuro, si el harness crece:

- `src/workflows/knowledge-engine/tools/vectorSearch.ts` (recorre todo el
  índice TF-IDF en cada consulta).
- `src/workflows/knowledge-engine/indexing/buildIndexes.ts` (reindexado
  completo del repo).
