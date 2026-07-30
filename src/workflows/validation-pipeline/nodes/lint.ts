import { makeStageNode } from "./makeStageNode.js";

export const lintNode = makeStageNode(
  "lint",
  (config) => config.validation.lintCommand,
  (config) => config.validation.timeouts.lintMs
);
