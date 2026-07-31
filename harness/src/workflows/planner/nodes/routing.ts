import type { PlannerStateType } from "../state.js";

export function routeAfterValidation(
  state: PlannerStateType
): "proceed" | "revise_plan" | "revisit_discovery" | "escalate" {
  if (state.validationVerdict === "valid") return "proceed";

  if (state.planningIteration >= state.maxPlanningIterations) {
    return "escalate"; // gobernanza: nunca reintentar indefinido
  }

  // Anti-fijación: si la mayoría de issues de esta vuelta apuntan a un gap
  // de entendimiento (no a un error de construcción del plan), no tiene
  // sentido regenerar Planning otra vez con el mismo Discovery.
  const discoveryGapRatio =
    state.validationIssues.filter((i) => i.rootCause === "discovery_gap").length /
    Math.max(state.validationIssues.length, 1);

  if (discoveryGapRatio > state.discoveryGapThreshold) return "revisit_discovery";
  return "revise_plan";
}
