import type { RecoveryStateType } from "../state.js";

export function routeStrategy(state: RecoveryStateType): "fix" | "rollback" | "abort" {
  if (state.strategy === "rollback") return "rollback";
  if (state.strategy === "abort") return "abort";
  return "fix"; // retry, partial_retry, change_context, change_model comparten el nodo prepare_fix
}
