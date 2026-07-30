import type { DecisionEntry } from "./types.js";

// Cada nodo del Orchestrator construía este objeto de 3 campos a mano; un
// solo constructor evita que el shape (y el timestamp) diverjan entre nodos.
export function decisionEntry(node: string, message: string): DecisionEntry {
  return { timestamp: new Date().toISOString(), node, message };
}
