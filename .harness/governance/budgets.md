# Política de presupuesto

Complementa los límites numéricos de `config/budgets.yml`.

- Un ticket que agota su presupuesto de tokens o costo antes de pasar el
  Quality Gate se marca `fail` y pasa a Recovery, nunca se reintenta
  silenciosamente sin registrar la razón en `decisionLog`.
- Si `budget_guard` detiene el run (`routeAfterBudgetCheck` -> `stop`), el
  backlog restante queda intacto para la próxima invocación del
  Orchestrator con el mismo `thread_id` (retomable vía checkpointer).
- Cambiar el presupuesto de un run en curso (`tokenBudget.limit`,
  `costBudget.limitUsd`) es una acción de categoría "Ask" (ver `approvals.md`).
