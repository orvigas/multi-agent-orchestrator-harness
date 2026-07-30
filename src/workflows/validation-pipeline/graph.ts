import { StateGraph, END } from "@langchain/langgraph";
import { ValidationState } from "./state.js";
import { compileNode } from "./nodes/compile.js";
import { testsNode } from "./nodes/tests.js";
import { lintNode } from "./nodes/lint.js";
import { staticAnalysisNode } from "./nodes/staticAnalysis.js";
import { securityNode } from "./nodes/security.js";
import { joinParallelChecksNode } from "./nodes/joinParallelChecks.js";
import { performanceNode } from "./nodes/performance.js";
import { assembleVerdictNode } from "./nodes/assembleVerdict.js";
import { routeAfterCompile, routeAfterTests, routeAfterParallelChecks } from "./nodes/routing.js";

const builder = new StateGraph(ValidationState)
  .addNode("compile", compileNode)
  .addNode("tests", testsNode)
  .addNode("lint", lintNode)
  .addNode("static_analysis", staticAnalysisNode)
  .addNode("security", securityNode)
  .addNode("join_parallel_checks", joinParallelChecksNode) // deferred: espera lint+static+security
  .addNode("performance", performanceNode)
  .addNode("assemble_verdict", assembleVerdictNode)

  .addEdge("__start__", "compile")
  .addConditionalEdges("compile", routeAfterCompile, {
    continue: "tests",
    fail_fast: "assemble_verdict", // no compiló: no sigas gastando tiempo
  })
  // fan-out condicional real: routeAfterTests devuelve un array de destinos
  // (["lint","static_analysis","security"]) cuando tests pasó, o
  // "assemble_verdict" directo si falló — así los tres quedan igualmente
  // condicionados al fail-fast (ver nota en nodes/routing.ts).
  .addConditionalEdges("tests", routeAfterTests, [
    "lint",
    "static_analysis",
    "security",
    "assemble_verdict",
  ])
  .addEdge("lint", "join_parallel_checks")
  .addEdge("static_analysis", "join_parallel_checks")
  .addEdge("security", "join_parallel_checks")

  .addConditionalEdges("join_parallel_checks", routeAfterParallelChecks, {
    continue: "performance",
    fail_fast: "assemble_verdict",
  })
  .addEdge("performance", "assemble_verdict")
  .addEdge("assemble_verdict", END);

// Sin LLM en ningún nodo (sección 0 del how-to): esta capa es solo
// tool-and-action + observation, nunca verificación interpretada ni
// estrategia — eso es 100% del Recovery Loop (Capa 6).
export const validationPipelineWorkflow = builder.compile();
