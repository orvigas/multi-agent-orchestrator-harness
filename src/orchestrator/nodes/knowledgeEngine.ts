import { knowledgeEngineWorkflow } from "../../workflows/knowledge-engine/graph.js";
import { decisionEntry } from "../decisionLog.js";
import type { OrchestratorStateType } from "../state.js";

// Adaptador entre OrchestratorState y KnowledgeState: son schemas distintos
// (a diferencia de planning/implementation/recovery, que reusan
// OrchestratorState), así que este nodo invoca el subgrafo manualmente en
// vez de registrarlo con addNode(subgrafo) directamente, y traduce el
// resultado a los campos que el Orchestrator sí entiende.
export async function knowledgeEngineNode(state: OrchestratorStateType) {
  const ticket = state.currentTicket;
  if (!ticket) {
    return {
      knowledgeEvidence: [],
      decisionLog: [decisionEntry("knowledge_engine", "Sin currentTicket; se omite la búsqueda de evidencia.")],
    };
  }

  const result = await knowledgeEngineWorkflow.invoke({ ticket });
  const evidence = result.evidencePackage ?? result.confirmedEvidence;

  return {
    knowledgeEvidence: evidence,
    decisionLog: [
      decisionEntry(
        "knowledge_engine",
        `Ticket ${ticket.id}: ${evidence.length} items de evidencia en ${result.iteration}/${result.maxIterations} ` +
          `iteraciones (sufficiency=${result.sufficiency}).`
      ),
    ],
  };
}
