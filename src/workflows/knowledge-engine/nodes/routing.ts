import type { KnowledgeStateType } from "../state.js";

export function routeAfterVerification(state: KnowledgeStateType): "narrow" | "sufficient" | "escalate" {
  if (state.sufficiency === "sufficient") return "sufficient";
  if (state.iteration >= state.maxIterations) return "escalate"; // gobernanza: no reintentar infinito
  return "narrow";
}
