import { applyPatch } from "../../implementation/tools/sandbox.js";
import type { MergeManagerStateType } from "../state.js";
import type { ConflictReport } from "../types.js";

// "Simular el merge sin aplicarlo" (how-to §3) sin git: applyPatch en modo
// dryRun hace el mismo chequeo de contexto contra el árbol REAL (targetPath)
// que Implementation Loop ya usa contra un sandbox — si el contexto de algún
// hunk ya no calza, el archivo real cambió desde que el patch se generó
// contra el snapshot del sandbox. Eso es un conflicto de verdad, detectado
// sin necesitar git en absoluto.
export function detectConflictsNode(state: MergeManagerStateType): { conflictReport: ConflictReport } {
  if (!state.patch || state.patch.hunks.length === 0) {
    return { conflictReport: { hasConflicts: false, files: [] } };
  }

  const result = applyPatch(state.targetPath, state.patch, { dryRun: true });

  return {
    conflictReport: {
      hasConflicts: !result.applied,
      files: result.conflictingFiles ?? [],
    },
  };
}
