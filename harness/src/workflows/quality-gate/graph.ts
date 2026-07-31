import { StateGraph, END } from "@langchain/langgraph";
import { QualityGateState } from "./state.js";
import { checkCoverageNode } from "./nodes/checkCoverage.js";
import { checkSonarNode } from "./nodes/checkSonar.js";
import { reviewArchitectureNode } from "./nodes/reviewArchitecture.js";
import { reviewDocumentationNode } from "./nodes/reviewDocumentation.js";
import { assembleReportNode } from "./nodes/assembleReport.js";

const builder = new StateGraph(QualityGateState)
  .addNode("check_coverage", checkCoverageNode)
  .addNode("check_sonar", checkSonarNode)
  .addNode("review_architecture", reviewArchitectureNode)
  .addNode("review_documentation", reviewDocumentationNode)
  .addNode("assemble_report", assembleReportNode)

  // Las 4 dimensiones nuevas no dependen entre sí -> fan-out/fan-in desde
  // __start__ directo, igual que lint/static/security en la Capa 5.
  .addEdge("__start__", "check_coverage")
  .addEdge("__start__", "check_sonar")
  .addEdge("__start__", "review_architecture")
  .addEdge("__start__", "review_documentation")
  .addEdge("check_coverage", "assemble_report")
  .addEdge("check_sonar", "assemble_report")
  .addEdge("review_architecture", "assemble_report")
  .addEdge("review_documentation", "assemble_report")
  .addEdge("assemble_report", END);

// Nunca modifica código: estructuralmente, este subgrafo no tiene forma de
// tocar el sandbox de la Capa 4 salvo para leerlo (ningún campo de estado
// tipo fixedPatch/appliedChange existe en QualityGateState).
export const qualityGateWorkflow = builder.compile();
