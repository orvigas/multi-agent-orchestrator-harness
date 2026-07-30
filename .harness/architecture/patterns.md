# Patrones a imitar

- **Workflows como subgrafos aislados** (`src/workflows/<layer>/`), cada uno
  con su propio `Annotation.Root` de estado — nunca comparten schema entre
  capas hermanas. Un solo adaptador en `src/orchestrator/nodes/` traduce
  entre `OrchestratorState` y el schema propio de cada capa; una task no
  debería necesitar tocar archivos de más de una carpeta
  `src/workflows/<layer>/` a la vez.
- **Routing puro**: las funciones `routeAfter*`/`route*` de cada capa
  solo leen el estado y devuelven un string (o array de strings para
  fan-out); nunca mutan estado ni tienen side effects, para que sean
  triviales de testear de forma aislada.
- **Contrato único por rol de modelo**: cualquier nodo que necesite un LLM
  pasa por `resolveModelForRole(role, config)` (`src/config/loadConfig.ts`),
  nunca instancia un `ChatAnthropic`/`ChatOpenAI` directamente — en la
  práctica, cada rol hoy es un stand-in determinista (ver ADRs), pero el
  contrato se mantiene para cuando se conecten modelos reales.
