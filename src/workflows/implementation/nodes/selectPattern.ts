import { loadImplementationConfig } from "../../../config/loadImplementationConfig.js";
import type { ImplementationStateType } from "../state.js";

export function selectPatternNode(state: ImplementationStateType) {
  const config = loadImplementationConfig();
  const task = state.task;

  const selectedPattern =
    task?.hasExistingTest || task?.expectedBehaviorIsTestable
      ? ("test_driven" as const)
      : task?.language === "typed" || task?.kind === "refactor" || task?.kind === "migration"
        ? ("compiler_driven" as const)
        : ("retry" as const);

  return {
    selectedPattern,
    maxIterations: config.implementation.maxIterationsPerTask,
  };
}
