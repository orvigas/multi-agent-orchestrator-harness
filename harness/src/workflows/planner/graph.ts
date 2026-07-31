import { StateGraph, END } from "@langchain/langgraph";
import { PlannerState } from "./state.js";
import { discoveryNode } from "./nodes/discovery.js";
import { planningNode } from "./nodes/planning.js";
import { validatePlanNode } from "./nodes/validatePlan.js";
import { escalateNode } from "./nodes/escalate.js";
import { routeAfterValidation } from "./nodes/routing.js";

// Nodo "discover", no "discovery": LangGraph prohíbe que un nombre de nodo
// coincida con el de un canal de estado, y `PlannerState.discovery` (la
// salida del nodo) ya ocupa ese nombre — el propio how-to usa "discovery"
// para ambos, lo cual falla en tiempo de compile() del grafo.
const builder = new StateGraph(PlannerState)
  .addNode("discover", discoveryNode)
  .addNode("planning", planningNode)
  .addNode("validate_plan", validatePlanNode)
  .addNode("escalate", escalateNode)

  .addEdge("__start__", "discover")
  .addEdge("discover", "planning")
  .addEdge("planning", "validate_plan")
  .addConditionalEdges("validate_plan", routeAfterValidation, {
    proceed: END, // plan válido -> Orchestrator sigue a Implementation
    revise_plan: "planning", // el plan está mal, el entendimiento no
    revisit_discovery: "discover", // el entendimiento está mal -> cambio de estrategia real
    escalate: "escalate",
  })
  .addEdge("escalate", END);

// Sin checkpointer propio: se invoca de forma síncrona como parte de un paso
// del Orchestrator (ver src/orchestrator/nodes/planner.ts), igual que el
// subgrafo del Knowledge Engine (Capa 2).
export const plannerWorkflow = builder.compile();
