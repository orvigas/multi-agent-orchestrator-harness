import { makeStageNode } from "./makeStageNode.js";

export const compileNode = makeStageNode(
  "compile",
  (config) => config.validation.compileCommand,
  (config) => config.validation.timeouts.compileMs
);
