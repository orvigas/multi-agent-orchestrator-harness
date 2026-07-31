import { cleanupSandbox } from "../../implementation/tools/sandbox.js";
import type { RecoveryStateType } from "../state.js";
import type { RecoveryEntry } from "../types.js";

// "Rollback" real de este harness (sin git worktree, ver ADR de la Capa 1):
// descarta el sandbox del intento fallido. El reset de `state.plan` a null
// (para que Planning regenere desde cero) lo hace el adaptador del
// Orchestrator (src/orchestrator/nodes/recovery.ts), que es quien ya posee
// ese campo — este subgrafo no lo declara (ver state.ts).
export function prepareRollbackNode(state: RecoveryStateType) {
  if (state.failedSandboxPath) cleanupSandbox(state.failedSandboxPath);

  const entry: RecoveryEntry = {
    iteration: state.recoveryIteration,
    diagnosis: state.diagnosis!,
    strategyChosen: "rollback",
  };

  return { recoveryHistory: [entry] };
}
