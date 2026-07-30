# Arquitectura: Orchestrator (Capa 1)

Este paquete implementa la Capa 1 del harness multi-agente descrita en
`01-orchestrator-langgraph-howto.md`, usando LangGraph.js.

```
bootstrap -> select_next_ticket -> budget_guard --continue--> planning -> implementation
                    ^                    |stop                              |
                    |                    v                              pass| |fail
                    +----------------- END                                  v v
                                                            select_next_ticket   recovery
```

- `src/orchestrator/` — el grafo principal, su estado y los nodos que no
  delegan a un subgrafo (bootstrap, selección de ticket, guardia de
  presupuesto, funciones de routing).
- `src/workflows/` — los tres subgrafos que el grafo principal invoca como
  nodos (`planning`, `implementation`, `recovery`). Hoy son stubs
  deterministas; su lógica real (LLM-driven) es trabajo futuro.
- `src/config/` — carga de `config/providers.yml` (qué modelo por rol) y
  de `.harness/**` (reglas/arquitectura/governance, con precedencia
  global -> project -> local).
