import { runCompileCheck, runSingleTest } from "../tools/quickChecks.js";
import { routeAfterQuickCheck } from "./routing.js";
import type { ImplementationStateType } from "../state.js";
import type { QuickCheckResult } from "../types.js";

export function quickCheckNode(state: ImplementationStateType) {
  const { selectedPattern, task, sandboxPath, patch, patchAttempts } = state;
  const applyFailure = state.quickCheck; // applyInSandboxNode ya deja un veredicto si la aplicación falló

  let result: QuickCheckResult;
  if (patch && patch.hunks.length === 0 && (task?.touchesFiles.length ?? 0) > 0) {
    // El Implementer se negó a generar un patch (p. ej. zona prohibida) para
    // una task que sí requería tocar archivos. Un compile-check sobre una
    // lista vacía de archivos "pasaría" vacuamente y ocultaría el problema
    // real — en vez de eso, se reporta la negativa explícitamente.
    result = { passed: false, signal: "refused", detail: patch.rationale };
  } else if (applyFailure && !applyFailure.passed) {
    // el patch nunca llegó a aplicarse: no hay nada real que compilar/testear
    result = applyFailure;
  } else if (selectedPattern === "test_driven" && task?.relatedTestId) {
    result = runSingleTest(sandboxPath!, task.relatedTestId);
  } else {
    // compiler_driven, y también el fallback de "retry" (la señal más
    // barata disponible), tal como en el how-to.
    result = runCompileCheck(sandboxPath!, patch?.hunks.map((h) => h.file) ?? []);
  }

  const attempts = [...patchAttempts];
  if (attempts.length > 0) {
    attempts[attempts.length - 1] = { ...attempts[attempts.length - 1], quickCheckResult: result };
  }

  // Reusa el propio router para dejar constancia en `outcome` cuando
  // corresponde escalar (el how-to declara el campo pero nunca lo escribe).
  const decision = routeAfterQuickCheck({ ...state, quickCheck: result, patchAttempts: attempts });

  return {
    quickCheck: result,
    patchAttempts: attempts,
    ...(decision === "escalate" ? { outcome: "escalate" as const } : {}),
  };
}
