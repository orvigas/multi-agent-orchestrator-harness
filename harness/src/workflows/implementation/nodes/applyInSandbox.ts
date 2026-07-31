import { createSandbox, applyPatch } from "../tools/sandbox.js";
import type { ImplementationStateType } from "../state.js";
import type { QuickCheckResult } from "../types.js";

export function applyInSandboxNode(state: ImplementationStateType): {
  sandboxPath: string;
  quickCheck: QuickCheckResult | null;
} {
  const taskId = state.task?.id ?? "unknown";
  const sandbox = createSandbox(taskId, state.targetPath);
  const applyResult = applyPatch(sandbox.path, state.patch!);

  return {
    sandboxPath: sandbox.path,
    // si la aplicación misma falló (contexto no encontrado), eso ya es una
    // señal de quick-check reprobada — quickCheckNode la respeta.
    quickCheck: applyResult.applied ? null : { passed: false, signal: "apply", detail: applyResult.detail },
  };
}
