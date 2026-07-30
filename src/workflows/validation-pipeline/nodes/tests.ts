import { makeStageNode } from "./makeStageNode.js";

// Corre la suite completa (no scoping por archivo tocado): en este repo el
// runner de tests no tiene un mapeo 1:1 archivo->test, y la suite completa
// corre en ~2s, así que no hay ganancia real en construir ese scoping.
export const testsNode = makeStageNode(
  "tests",
  (config) => config.validation.testCommand,
  (config) => config.validation.timeouts.testsMs,
  6000
);
