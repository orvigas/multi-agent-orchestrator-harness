# Gobernanza del Knowledge Engine

- Máximo 5 iteraciones de explore-narrow por ticket. Al llegar al límite sin
  evidencia suficiente: escalar al humano con el registro de `triedQueries` y
  `discardedEvidence`, nunca inventar contexto.
- El verificador (`kb_verifier`) es un rol distinto al planner (`retriever`).
  Nunca deben resolver al mismo modelo/instancia en la misma corrida.
- La evidencia confirmada no debe exceder 12 items ni 40 líneas por item.
  Si Planning necesita más detalle de un item específico, lo pide en una
  iteración siguiente — no se sube el límite global.
