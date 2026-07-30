# ADR 0001: Usar MemorySaver en vez de PostgresSaver por defecto

## Estado

Aceptado.

## Contexto

El how-to original (`01-orchestrator-langgraph-howto.md`, sección 3)
compila el grafo con `PostgresSaver.fromConnString(process.env.CHECKPOINT_DB_URL!)`.
Este proyecto no tiene todavía una instancia de Postgres disponible, y el
propio `npm install` del how-to no incluye el paquete
`@langchain/langgraph-checkpoint-postgres`.

## Decisión

`src/orchestrator/graph.ts` compila el Orchestrator con `MemorySaver`
(exportado directamente por `@langchain/langgraph`), que no requiere
infraestructura externa.

## Consecuencias

- `npm run dev` funciona sin levantar ninguna base de datos.
- Los checkpoints no sobreviven a un reinicio del proceso.
- Migrar a `PostgresSaver` más adelante es un cambio de una línea en
  `graph.ts` (instalar el paquete de checkpoint-postgres y pasar
  `PostgresSaver.fromConnString(process.env.CHECKPOINT_DB_URL!)`), sin
  tocar el resto del grafo.
