# Gobernanza del Planner

- Máximo 4 iteraciones combinadas (revise_plan + revisit_discovery) por
  ticket. Al llegar al límite: escalar con el historial completo de
  `planRevisions` y `validationIssues` — nunca forzar un plan que Validation
  ya rechazó dos veces por la misma regla.
- `plan_validator` debe resolver a un proveedor de IA distinto al de
  `planner` (ver config/planner.yml). Nunca deben compartir proveedor.
- Si >50% de los issues de una vuelta son "discovery_gap", es obligatorio
  volver a Discovery, no seguir regenerando el plan (previene plan fixation).
- Validation nunca modifica el plan directamente. Su única salida es
  verdict + issues clasificados por rootCause.
