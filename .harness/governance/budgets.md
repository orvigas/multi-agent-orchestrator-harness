# Política de presupuesto

Complementa los límites numéricos de `config/orchestrator.yml`.

- Un ticket que agota su presupuesto de tokens o costo antes de pasar el
  Quality Gate se marca `fail` y pasa a Recovery, nunca se reintenta
  silenciosamente sin registrar la razón en `decisionLog`.
- Si `budget_guard` detiene el run (`routeAfterBudgetCheck` -> `stop`), el
  backlog restante queda intacto DENTRO del mismo proceso y se recupera entre
  invocaciones de `npm run dev`/`harness:execute` gracias a
  `SqliteSaver` (Phase 1.1 implementado, 2026-07-30). El checkpointer persiste
  en `./data/harness-checkpoints.db` (configurable via `CHECKPOINT_DB_PATH`).
  Migración a PostgreSQL es candidata para Phase 1.3 para deployments multi-proceso.
- Cambiar el presupuesto de un run en curso (`tokenBudget.limit`,
  `costBudget.limitUsd`) es una acción de categoría "Ask" (ver `approvals.md`).
