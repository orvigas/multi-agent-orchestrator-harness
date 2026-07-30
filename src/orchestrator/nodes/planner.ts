import { plannerWorkflow } from "../../workflows/planner/graph.js";
import { decisionEntry } from "../decisionLog.js";
import type { OrchestratorStateType } from "../state.js";

// Adaptador entre OrchestratorState y PlannerState: son schemas distintos
// (igual que con KnowledgeState en la Capa 2), así que este nodo invoca el
// subgrafo manualmente y traduce el resultado a los campos que el
// Orchestrator sí entiende, en vez de registrar el subgrafo directamente
// con addNode(subgrafo).
export async function plannerNode(state: OrchestratorStateType) {
  const ticket = state.currentTicket;
  if (!ticket) {
    return {
      plan: null,
      decisionLog: [decisionEntry("planning", "Sin currentTicket; se omite Discovery/Planning/Validation.")],
    };
  }

  const result = await plannerWorkflow.invoke({ ticket, evidence: state.knowledgeEvidence, targetPath: state.targetPath });
  const accepted = result.validationVerdict === "valid";

  return {
    plan: accepted ? result.plan : null,
    decisionLog: [
      decisionEntry(
        "planning",
        `Ticket ${ticket.id}: Discovery/Planning/Validation -> ${result.validationVerdict} en ` +
          `${result.planningIteration}/${result.maxPlanningIterations} iteraciones ` +
          `(${result.planRevisions.length} revisión(es), ${result.validationIssues.length} issue(s) pendiente(s)).`
      ),
    ],
  };
}
