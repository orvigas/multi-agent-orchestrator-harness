import type { KnowledgeStateType } from "../state.js";

// Se alcanza cuando se agota maxIterations sin evidencia suficiente. La
// política real de escalamiento (a quién avisar, qué hacer con
// triedQueries/discardedEvidence) es del Recovery Loop (Capa 6), todavía no
// construido — por ahora este nodo solo deja el estado tal cual para que el
// nodo adaptador del Orchestrator (src/orchestrator/nodes/knowledgeEngine.ts)
// lo registre en decisionLog.
export function escalateNode(_state: KnowledgeStateType) {
  return {};
}
