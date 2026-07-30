# Gobernanza del Merge Manager

- Este proyecto NO es un repositorio git (ver `.claude/CLAUDE.md`): no hay
  `origin/main`, ramas, ni historia contra la cual mergear. Merge Manager
  adapta el how-to (`08-merge-manager-howto.md`) en vez de seguirlo literal:
  - "git merge" → promover el patch ya validado directamente sobre el árbol
    real (`applyPatch`, la misma mecánica de contexto que usa Implementation
    Loop contra sandboxes — nunca por número de línea).
  - "git tag" → una entrada en un log local append-only
    (`mergeManager.releaseLogPath`, `.harness/releases.jsonl`), un tag
    `release-N` por ticket (solo `tagNamingStrategy: "auto-increment"` tiene
    comportamiento real; `"semver"` no está implementado).
  - "close ticket" (tracker externo: GitHub/Jira/Linear) → marcar el ticket
    `"done"` en `state.backlog`, que ya sucede en `implementationNode`.
  - "notifyOperations" (Slack/PagerDuty) → un archivo JSON de escalación real
    en `mergeManager.escalationDir` (sin credenciales de servicios externos
    configuradas en este proyecto).
- **Detección de conflictos sin git**: se reutiliza `applyPatch` en modo
  `dryRun` — el mismo chequeo de contexto (`contextBefore+oldLines+contextAfter`)
  que Implementation Loop usa para aplicar un patch, corrido ahora contra el
  árbol REAL sin escribir. Si el contexto de un hunk ya no calza, el archivo
  real cambió desde que el patch se generó contra el snapshot del sandbox —
  un conflicto de verdad, sin necesitar git en absoluto.
- **El ruteo de conflictos es binario (`no_conflicts | conflict`), no de tres
  vías** como en el how-to (`no_conflicts | resolvable | unresolvable`): sin
  git no existe un concepto de "ours/theirs" que resolver automáticamente, y
  la propia implementación de referencia del how-to (`checkIfAutoresolvable`)
  ya hardcodea `return false` — "política conservadora: siempre escala
  conflictos de verdad". No hay un nodo `resolve_conflicts` en este código:
  construir uno sin lógica real detrás sería un stub a medio terminar, no una
  fidelidad al diseño original.
- **Conflictos detectados SIEMPRE escalan a humano, nunca se autoresuelven.**
  Esto se implementa reutilizando la regla dura de Recovery para Security
  (`decideStrategyNode`): `rootCause === "MergeConflict"` → `"abort"` siempre,
  sin importar presupuesto de reintentos ni si es la primera vez. Un conflicto
  de merge significa que el árbol real divergió de lo que el sandbox asumía —
  ningún reintento del mismo patch (ni de una variante) arregla eso.
- **`dryRun: true` por defecto** (`config/merge-manager.yml`): sin git no hay
  forma de deshacer una escritura real al árbol de trabajo. Con `dryRun:true`
  toda la pipeline corre de verdad (detección de conflictos contra el árbol
  real, entrada en el release log, cierre de ticket) pero `promote_patch` NO
  escribe. Cambiar a `false` es una decisión humana deliberada y posterior —
  cuando se haga, cada task promovida por el Orchestrator escribirá de verdad
  sobre los archivos reales de este proyecto.
- **Granularidad**: la detección de conflictos y la promoción corren POR
  TASK, invocadas inline en el mismo loop de `implementationNode` que ya
  corre Validation Pipeline y Quality Gate (Capa 5/7) — no como un nodo nuevo
  del Orchestrator. El tag/cierre de ticket (`appendReleaseLogEntry`) corre
  UNA VEZ POR TICKET, al final de ese loop, porque opera sobre el plan
  completo, no sobre una task individual.
