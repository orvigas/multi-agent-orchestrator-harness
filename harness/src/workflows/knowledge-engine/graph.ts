import { StateGraph, END } from "@langchain/langgraph";
import { KnowledgeState } from "./state.js";
import { loadStaticContextNode } from "./nodes/loadStaticContext.js";
import { planRetrievalNode } from "./nodes/planRetrieval.js";
import { executeRetrievalNode } from "./nodes/executeRetrieval.js";
import { verifyEvidenceNode } from "./nodes/verifyEvidence.js";
import { assemblePackageNode } from "./nodes/assemblePackage.js";
import { escalateNode } from "./nodes/escalate.js";
import { routeAfterVerification } from "./nodes/routing.js";

const builder = new StateGraph(KnowledgeState)
  .addNode("load_static_context", loadStaticContextNode) // .harness/rules + architecture + ADRs, SIEMPRE primero
  .addNode("plan_retrieval", planRetrievalNode) // decide la SIGUIENTE acción (no todas)
  .addNode("execute_retrieval", executeRetrievalNode) // llama ast_query / grep / vector_search
  .addNode("verify_evidence", verifyEvidenceNode) // verificador independiente
  .addNode("assemble_package", assemblePackageNode) // solo si sufficiency === "sufficient"
  .addNode("escalate", escalateNode) // solo si sufficiency === "escalate"

  .addEdge("__start__", "load_static_context")
  .addEdge("load_static_context", "plan_retrieval")
  .addEdge("plan_retrieval", "execute_retrieval")
  .addEdge("execute_retrieval", "verify_evidence")
  .addConditionalEdges("verify_evidence", routeAfterVerification, {
    narrow: "plan_retrieval", // seguir explorando con una consulta más específica
    sufficient: "assemble_package",
    escalate: "escalate",
  })
  .addEdge("assemble_package", END)
  .addEdge("escalate", END);

// Sin checkpointer propio: se invoca de forma síncrona como parte de un paso
// del Orchestrator (ver src/orchestrator/nodes/knowledgeEngine.ts), igual que
// los subgrafos de la Capa 1.
export const knowledgeEngineWorkflow = builder.compile();
