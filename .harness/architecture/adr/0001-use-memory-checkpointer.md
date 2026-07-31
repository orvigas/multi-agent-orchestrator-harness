# ADR 0001: Usar MemorySaver en vez de PostgresSaver por defecto

## Estado

**Superseded by Phase 1.1 SQLite Checkpointer (2026-07-30)**

## Contexto (Histórico)

El how-to original (`01-orchestrator-langgraph-howto.md`, sección 3)
compila el grafo con `PostgresSaver.fromConnString(process.env.CHECKPOINT_DB_URL!)`.
Este proyecto no tenía una instancia de Postgres disponible en el momento de esta decisión.

## Decisión Original

`src/orchestrator/graph.ts` compilaba el Orchestrator con `MemorySaver`
(exportado directamente por `@langchain/langgraph`), que no requiere
infraestructura externa.

## Consecuencias de la Decisión Original

- `npm run dev` funcionaba sin levantar ninguna base de datos.
- Los checkpoints no sobrevivían a un reinicio del proceso.
- Fue un punto de escalado identificado en análisis de gaps.

## Supersesión (Phase 1.1)

**Decisión Actualizada (2026-07-30)**: Se implementó `SqliteSaver` como checkpointer persistente por defecto.

- `src/persistence/checkpointer.ts` ahora usa `SqliteSaver.fromConnString()`
- Checkpoints persisten en `./data/harness-checkpoints.db` (configurable via `CHECKPOINT_DB_PATH`)
- `npm run dev` funciona sin infraestructura externa (SQLite es file-based)
- Migración a `PostgresSaver` en Phase 1.3 es cambio de una línea en `checkpointer.ts`
- Todos los checkpoints entre runs persisten y son recuperables

Véase `PRODUCTION.md` § "Checkpoint Database" para la implementación actual.
