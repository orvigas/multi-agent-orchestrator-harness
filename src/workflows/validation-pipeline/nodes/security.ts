import { makeStageNode } from "./makeStageNode.js";

export const securityNode = makeStageNode(
  "security",
  (config) => config.validation.securityCommand,
  (config) => config.validation.timeouts.securityMs
);
