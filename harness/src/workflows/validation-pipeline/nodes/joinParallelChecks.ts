import type { ValidationStateType } from "../state.js";

// Nodo puramente de sincronización — LangGraph ya esperó a los 3 fan-out
// (lint, static_analysis, security) antes de ejecutar este nodo. No
// necesita lógica propia; existe para tener un punto de conditional edge.
export function joinParallelChecksNode(_state: ValidationStateType) {
  return {};
}
