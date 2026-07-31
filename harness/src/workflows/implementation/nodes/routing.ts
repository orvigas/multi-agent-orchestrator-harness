import type { ImplementationStateType } from "../state.js";

export function routeAfterQuickCheck(state: ImplementationStateType): "ready" | "retry" | "escalate" {
  if (state.quickCheck?.passed) return "ready";
  // "refused": el Implementer se negó a generar un patch (p. ej. zona
  // prohibida) para una task que sí requería tocar archivos. Ningún
  // reintento produce un patch distinto para la misma task — escala de
  // inmediato en vez de gastar maxIterations en vano.
  if (state.quickCheck?.signal === "refused") return "escalate";
  if (state.iteration >= state.maxIterations) return "escalate";
  return "retry";
}
