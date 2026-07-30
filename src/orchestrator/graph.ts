import { StateGraph, END } from "@langchain/langgraph";
import { OrchestratorState } from "./state.js";
import { createCheckpointer } from "../persistence/checkpointer.js";
import { bootstrapNode } from "./nodes/bootstrap.js";
import { selectNextTicketNode } from "./nodes/selectNextTicket.js";
import { knowledgeEngineNode } from "./nodes/knowledgeEngine.js";
import { plannerNode } from "./nodes/planner.js";
import { implementationNode } from "./nodes/implementation.js";
import { recoveryNode } from "./nodes/recovery.js";
import { abortTicketNode } from "./nodes/abortTicket.js";
import { budgetGuardNode } from "./nodes/budgetGuard.js";
import { routeAfterBudgetCheck, routeAfterImplementation, routeAfterRecovery } from "./nodes/routing.js";

const builder = new StateGraph(OrchestratorState)
  .addNode("bootstrap", bootstrapNode) // carga config .md/.yml
  .addNode("select_next_ticket", selectNextTicketNode)
  .addNode("knowledge_engine", knowledgeEngineNode) // SUBGRAFO Capa 2: evidencia, no documentos
  .addNode("budget_guard", budgetGuardNode) // ¿queda presupuesto/tiempo?
  .addNode("planning", plannerNode) // SUBGRAFO Capa 3: Discovery -> Planning -> Validation
  .addNode("implementation", implementationNode) // SUBGRAFO Capa 4: itera state.plan.order
  .addNode("recovery", recoveryNode) // SUBGRAFO Capa 6: diagnóstico -> estrategia -> fix
  .addNode("abort_ticket", abortTicketNode) // bloquea el ticket, no todo el run (ver nodes/abortTicket.ts)
  .addEdge("__start__", "bootstrap")
  .addEdge("bootstrap", "select_next_ticket")
  .addEdge("select_next_ticket", "knowledge_engine")
  .addEdge("knowledge_engine", "budget_guard")
  .addConditionalEdges("budget_guard", routeAfterBudgetCheck, {
    continue: "planning",
    stop: END,
  })
  .addEdge("planning", "implementation")
  .addConditionalEdges("implementation", routeAfterImplementation, {
    pass: "select_next_ticket", // siguiente ticket
    fail: "recovery",
  })
  .addConditionalEdges("recovery", routeAfterRecovery, {
    retry_implementation: "implementation",
    retry_planning: "planning", // <- "cambiar de estrategia", no solo reintentar
    change_model: "implementation", // el nodo lee state.config.roles.implementer actualizado
    abort: "abort_ticket",
  })
  .addEdge("abort_ticket", "select_next_ticket");

// SQLiteSaver (MVP): archivo local, sin servidor, perfecto para single-process
// Migra a PostgreSQL más tarde si necesitas múltiples instancias (ver sqlite-to-postgres-migration.md)
// Env vars:
//   CHECKPOINT_DB_PATH: ruta a SQLite .db file (default: ./data/harness-checkpoints.db)
//   CHECKPOINT_DB_URL: connection string PostgreSQL (cuando escales)
export let orchestrator: ReturnType<typeof builder.compile> | null = null; // Lazy initialization

export async function initializeOrchestrator() {
  const checkpointer = createCheckpointer();
  orchestrator = builder.compile({ checkpointer });
  return orchestrator;
}
