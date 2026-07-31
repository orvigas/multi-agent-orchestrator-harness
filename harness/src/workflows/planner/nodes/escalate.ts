import type { PlannerStateType } from "../state.js";

// Se alcanza al agotar maxPlanningIterations sin un plan válido. La política
// real de escalamiento (Recovery Loop, Capa 6) todavía no existe — este nodo
// solo deja el estado tal cual para que el adaptador del Orchestrator
// (src/orchestrator/nodes/planner.ts) lo registre en decisionLog.
export function escalateNode(_state: PlannerStateType) {
  return {};
}
