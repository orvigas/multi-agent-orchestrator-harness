# Escalamiento

Cuándo el Orchestrator debe detenerse y pedir intervención humana en vez
de seguir el loop automático de recovery:

- Una tarea toca una zona prohibida (`rules/forbidden-zones.md`) —
  escalar directo, sin pasar por Recovery.
- `routeAfterRecovery` devuelve `abort` (se agotaron los reintentos para
  el ticket actual).
- `budget_guard` detiene el run por presupuesto o deadline agotados
  mientras aún quedan tickets `pending` en el backlog.
- `strategy` es `change_model` pero el rol correspondiente no tiene un
  segundo modelo configurado en `config/providers.yml`.
