import { applyPatch } from "../../implementation/tools/sandbox.js";
import type { MergeManagerStateType } from "../state.js";

// "git merge" sin git: el patch ya probó (detect_conflicts) que su contexto
// calza contra el árbol real, así que aplicarlo de verdad ahí ES el merge —
// misma mecánica de applyPatch que Implementation Loop usa contra sandboxes,
// apuntada ahora al árbol real (state.targetPath).
//
// dryRun (config/merge-manager.yml, ver .harness/governance/merge-manager.md):
// sin git no hay forma de deshacer una escritura real, así que por defecto
// esta capa NO escribe — reporta como si hubiera promovido (el chequeo de
// conflictos ya fue real) pero deja el árbol intacto.
export function promotePatchNode(state: MergeManagerStateType): { promoted: boolean } {
  if (!state.patch || state.patch.hunks.length === 0) {
    return { promoted: true };
  }

  if (state.dryRun) {
    return { promoted: true };
  }

  const result = applyPatch(state.targetPath, state.patch);
  return { promoted: result.applied };
}
