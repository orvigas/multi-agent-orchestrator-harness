import { StateGraph, END } from "@langchain/langgraph";
import { MergeManagerState } from "./state.js";
import { detectConflictsNode } from "./nodes/detectConflicts.js";
import { promotePatchNode } from "./nodes/promotePatch.js";
import { escalateNode } from "./nodes/escalate.js";
import { routeConflicts } from "./routing.js";

const builder = new StateGraph(MergeManagerState)
  .addNode("detect_conflicts", detectConflictsNode)
  .addNode("promote_patch", promotePatchNode)
  .addNode("escalate", escalateNode)

  .addEdge("__start__", "detect_conflicts")
  .addConditionalEdges("detect_conflicts", routeConflicts, {
    no_conflicts: "promote_patch",
    conflict: "escalate",
  })
  .addEdge("promote_patch", END)
  .addEdge("escalate", END);

// Invocado por task, no por ticket (mismo patrón que Validation Pipeline y
// Quality Gate en src/orchestrator/nodes/implementation.ts) — el tag/cierre
// de ticket a nivel de plan completo vive en releaseLog.ts, invocado
// directamente por ese loop, no como nodo de este subgrafo.
export const mergeManagerWorkflow = builder.compile();
