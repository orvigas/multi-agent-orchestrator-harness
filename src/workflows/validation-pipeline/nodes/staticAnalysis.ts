import { makeStageNode } from "./makeStageNode.js";

export const staticAnalysisNode = makeStageNode(
  "static_analysis",
  (config) => config.validation.staticAnalysisCommand,
  (config) => config.validation.timeouts.staticAnalysisMs
);
