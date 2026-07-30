# Gobernanza del Quality Gate

- El Quality Gate NUNCA modifica código ni aplica sus propias recomendaciones.
  Su única salida es `issues[]` + `verdict`.
- Compilation/Tests/Security/Performance nunca se re-ejecutan aquí — se leen
  de `validationEvidence` (Capa 5). Duplicar esas corridas es un error de
  implementación, no una mejora de cobertura de análisis.
- Un issue de dimensión "Architecture" siempre es "blocking" — nunca
  "advisory" — porque una desalineación arquitectónica aceptada sin revisión
  humana es exactamente el tipo de deuda que este harness existe para evitar.
- Un issue de dimensión "Documentation" nunca bloquea el merge por sí solo:
  se registra como advisory y se convierte en un ticket de seguimiento en
  el backlog del Orchestrator (`state.backlog`, Capa 1), no en un bloqueo del
  ticket actual.
- Verdict "blocking": el ticket vuelve al Recovery Loop (Capa 6) con las
  `issues` de severidad blocking como entrada — reutilizando su nodo
  `diagnose`, no un mecanismo nuevo de reintento.
- Los tickets de seguimiento que genera `toFollowUpTickets` a partir de un
  verdict "advisory_only" llevan `origin: "quality_gate"` y NUNCA generan
  otra ronda de seguimiento al procesarse (`implementationNode` lo comprueba
  antes de llamar a `toFollowUpTickets` de nuevo). Sin este tope de una sola
  generación, un advisory persistente (p. ej. cobertura que baja un poco en
  cada cambio) encola tickets sin fin y el Orchestrator nunca termina —
  revienta el `recursionLimit` de LangGraph en vez de drenar el backlog. Esto
  se descubrió corriendo `npm run dev` de punta a punta, no leyendo el how-to.
- El id de cada ticket de seguimiento incluye el `taskId` que lo originó
  (`${ticketId}-${taskId}-followup-${dimension}-${i}`), no solo el índice del
  issue dentro de esa llamada. `toFollowUpTickets` se invoca una vez POR TASK
  dentro del loop de `implementationNode`, así que un índice reiniciado en
  cada llamada produce ids duplicados en cuanto dos tasks del mismo plan
  levantan el mismo issue (p. ej. "Sonar" en cada task) — visible en
  `=== Backlog final ===` de `npm run dev` como filas con el mismo id.
- El comando de `qualityGate.coverage.command` (`config/quality-gate.yml`) es
  deliberadamente una lista MÁS CHICA que el `test` de `package.json`: excluye
  los tests que crean sandboxes reales y corren subprocesos de verdad
  (`sandbox.test.ts`, `quickChecks.test.ts`, `exec.test.ts`, y los propios
  tests del Quality Gate). Ese comando se re-ejecuta en CADA task (baseline se
  cachea, pero el "after" no), así que incluir tests pesados ahí no es solo
  lento — compone linealmente con el número de tasks/tickets del backlog. Si
  se agrega un test nuevo con subproceso/sandbox real, no lo agregues a esta
  lista salvo que midas el costo primero.
