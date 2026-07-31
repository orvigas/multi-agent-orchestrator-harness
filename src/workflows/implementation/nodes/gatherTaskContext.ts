import { knowledgeEngineWorkflow } from "../../knowledge-engine/graph.js";
import type { ImplementationStateType } from "../state.js";

// Just-in-time: reusa el Knowledge Engine (Capa 2) real, pero acotado a esta
// task puntual (no al ticket completo) — más fino que la evidencia que ya
// reunió el Orchestrator antes de Planning.
export async function gatherTaskContextNode(state: ImplementationStateType) {
  const task = state.task;
  if (!task) return { taskContext: [] };

  const result = await knowledgeEngineWorkflow.invoke({
    ticket: { id: task.id, title: task.description },
    targetPath: state.targetPath,
  });

  return { taskContext: result.evidencePackage ?? result.confirmedEvidence };
}
