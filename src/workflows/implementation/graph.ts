import { StateGraph, END } from "@langchain/langgraph";
import { ImplementationState } from "./state.js";
import { selectPatternNode } from "./nodes/selectPattern.js";
import { gatherTaskContextNode } from "./nodes/gatherTaskContext.js";
import { generatePatchNode } from "./nodes/generatePatch.js";
import { applyInSandboxNode } from "./nodes/applyInSandbox.js";
import { quickCheckNode } from "./nodes/quickCheck.js";
import { escalateNode } from "./nodes/escalate.js";
import { routeAfterQuickCheck } from "./nodes/routing.js";

const builder = new StateGraph(ImplementationState)
  .addNode("select_pattern", selectPatternNode)
  .addNode("gather_task_context", gatherTaskContextNode) // just-in-time, reusa Knowledge Engine
  .addNode("generate_patch", generatePatchNode)
  .addNode("apply_in_sandbox", applyInSandboxNode)
  .addNode("quick_check", quickCheckNode)
  .addNode("escalate", escalateNode)

  .addEdge("__start__", "select_pattern")
  .addEdge("select_pattern", "gather_task_context")
  .addEdge("gather_task_context", "generate_patch")
  .addEdge("generate_patch", "apply_in_sandbox")
  .addEdge("apply_in_sandbox", "quick_check")
  .addConditionalEdges("quick_check", routeAfterQuickCheck, {
    ready: END, // pasa a la Capa 5 completa
    retry: "generate_patch", // vuelve a intentar CON el feedback del quick_check
    escalate: "escalate",
  })
  .addEdge("escalate", END);

// Sin checkpointer propio: se invoca de forma síncrona una vez por task
// (ver src/orchestrator/nodes/implementation.ts), igual que los subgrafos
// de Knowledge Engine y Planner.
export const implementationWorkflow = builder.compile();
