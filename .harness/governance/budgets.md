# Política de presupuesto

Complementa los límites numéricos de `config/orchestrator.yml`.

- Un ticket que agota su presupuesto de tokens o costo antes de pasar el
  Quality Gate se marca `fail` y pasa a Recovery, nunca se reintenta
  silenciosamente sin registrar la razón en `decisionLog`.
- Si `budget_guard` detiene el run (`routeAfterBudgetCheck` -> `stop`), el
  backlog restante queda intacto DENTRO del mismo proceso — pero el
  checkpointer real de este proyecto es `MemorySaver` (ADR 0001), que vive
  en memoria y se pierde al terminar el proceso. "Retomable vía
  checkpointer con el mismo `thread_id`" solo es cierto si el proceso sigue
  vivo; no hay recuperación real entre invocaciones separadas de
  `npm run dev`/`harness:execute` hasta que se adopte un checkpointer
  persistente (ver ADR 0001 y el análisis de gaps frente a
  IMPLEMENTATION_GUIDE.md §6.7.1 — candidato: `@langchain/langgraph-
  checkpoint-sqlite`, no Postgres).
- Cambiar el presupuesto de un run en curso (`tokenBudget.limit`,
  `costBudget.limitUsd`) es una acción de categoría "Ask" (ver `approvals.md`).
