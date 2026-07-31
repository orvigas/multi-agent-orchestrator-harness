import { StateGraph, END } from "@langchain/langgraph";
import { RecoveryState } from "./state.js";
import { diagnoseNode } from "./nodes/diagnose.js";
import { decideStrategyNode } from "./nodes/decideStrategy.js";
import { prepareFixNode } from "./nodes/prepareFix.js";
import { prepareRollbackNode } from "./nodes/prepareRollback.js";
import { prepareEscalationNode } from "./nodes/prepareEscalation.js";
import { routeStrategy } from "./nodes/routing.js";

const builder = new StateGraph(RecoveryState)
  .addNode("diagnose", diagnoseNode)
  .addNode("decide_strategy", decideStrategyNode)
  .addNode("prepare_fix", prepareFixNode)
  .addNode("prepare_rollback", prepareRollbackNode)
  .addNode("prepare_escalation", prepareEscalationNode)

  .addEdge("__start__", "diagnose")
  .addEdge("diagnose", "decide_strategy")
  .addConditionalEdges("decide_strategy", routeStrategy, {
    fix: "prepare_fix", // retry, partial_retry, change_context, change_model
    rollback: "prepare_rollback",
    abort: "prepare_escalation",
  })
  .addEdge("prepare_fix", END)
  .addEdge("prepare_rollback", END)
  .addEdge("prepare_escalation", END);

// Este subgrafo NO vuelve a llamarse a sí mismo internamente: produce un
// strategy + una acción preparada, y es routeAfterRecovery (Capa 1) el que
// decide a qué nodo del grafo principal volver. La memoria de "cuántas veces
// ya se intentó" vive en un solo lugar: recoveryHistory a nivel de ticket
// (en OrchestratorState, threaded hacia este subgrafo por el adaptador).
export const recoveryWorkflow = builder.compile();
