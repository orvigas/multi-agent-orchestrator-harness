import type { MergeManagerStateType } from "./state.js";

// Binario, no tres vías (how-to §2 tiene no_conflicts/resolvable/unresolvable):
// sin git no existe un "ours/theirs" que resolver automáticamente, y la
// propia política del how-to ya es conservadora (checkIfAutoresolvable
// siempre devuelve false) — ver .harness/governance/merge-manager.md.
export function routeConflicts(state: MergeManagerStateType): "no_conflicts" | "conflict" {
  return state.conflictReport?.hasConflicts ? "conflict" : "no_conflicts";
}
