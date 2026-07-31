import type { RecoveryStateType } from "../state.js";
import type { PlanTask } from "../../planner/types.js";
import type { RecoveryEntry } from "../types.js";

// El "Fix" que nunca regenera todo el patch: touchesFiles se limita
// exactamente a lo que la task original ya tocaba (failedTask), nunca más
// amplio (gobernanza §8) — si el diagnóstico sugiriera un problema más
// amplio, la estrategia correcta ya habría sido "change_context", no llegar
// hasta acá.
export function prepareFixNode(state: RecoveryStateType) {
  const { diagnosis, strategy, failedTask } = state;

  const targetedFixTask: PlanTask = {
    id: `fix-${Date.now()}`,
    description: `Corrige específicamente: ${diagnosis!.detail}. No modifiques nada fuera de esto.`,
    touchesFiles: failedTask?.touchesFiles ?? [],
    hasExistingTest: diagnosis!.rootCause === "Tests",
    language: failedTask?.language,
    kind: "targeted_fix",
  };

  const entry: RecoveryEntry = {
    iteration: state.recoveryIteration,
    diagnosis: diagnosis!,
    strategyChosen: strategy,
  };

  return {
    targetedFixTask,
    recoveryHistory: [entry],
  };
}
