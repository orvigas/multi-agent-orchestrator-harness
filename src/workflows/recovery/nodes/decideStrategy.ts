import type { RecoveryStateType } from "../state.js";
import type { Strategy } from "../types.js";

// Stand-in determinista para el rol "recovery_strategist": las reglas duras
// (presupuesto agotado, Security, fallo repetido) son ya deterministas en el
// propio how-to — se implementan tal cual. Solo la "zona de juicio" final
// (un fallo nuevo, no repetido, no Security) es una heurística en vez de una
// llamada real a un modelo: confidence "low" (o sin intentos previos que lo
// respalden) -> "retry"; confidence "high" con >=2 intentos de patch ya
// fallidos -> "rollback" (seguir insistiendo incrementalmente no está
// funcionando). "partial_retry"/"change_context" fuera de las reglas duras
// no tienen una señal real distinta en este sistema (no hay mecanismo de
// patch parcial granular), así que no se producen fuera de esos casos —
// igual que otras capas dejan valores del tipo alcanzables solo por reglas
// explícitas, no por la heurística de juicio.
export function decideStrategyNode(state: RecoveryStateType): { strategy: Strategy; recoveryIteration: number } {
  const { diagnosis, recoveryIteration, maxRecoveryIterations, patchAttempts } = state;
  const nextIteration = recoveryIteration + 1;

  // Regla dura 1: presupuesto de recovery agotado -> abort, sin importar el diagnóstico
  if (recoveryIteration >= maxRecoveryIterations) {
    return { strategy: "abort", recoveryIteration: nextIteration };
  }

  // Regla dura 2: Security SIEMPRE requiere aprobación humana, nunca autofix silencioso
  if (diagnosis!.rootCause === "Security") {
    return { strategy: "abort", recoveryIteration: nextIteration }; // "abort" aquí = escalar, no continuar solo
  }

  // Regla dura 2b: MergeConflict (Capa 8) SIEMPRE escala, nunca autoresuelve
  // — el árbol real divergió del snapshot del sandbox; reintentar el mismo
  // patch (o cualquier variante) no arregla una divergencia externa. Ver
  // .harness/governance/merge-manager.md.
  if (diagnosis!.rootCause === "MergeConflict") {
    return { strategy: "abort", recoveryIteration: nextIteration };
  }

  // Regla dura 3: mismo error repetido -> cambiar de estrategia, NUNCA reintentar igual
  if (diagnosis!.isRepeatedFailure) {
    if (diagnosis!.rootCause === "Architecture" || diagnosis!.rootCause === "Dependencies") {
      // change_context aquí significa: el Orchestrator vuelve a Planning, no a Implementation
      return { strategy: "change_context", recoveryIteration: nextIteration };
    }
    return { strategy: "change_model", recoveryIteration: nextIteration };
  }

  // Zona de juicio: fallo nuevo, no repetido, no Security.
  const strategy: Strategy =
    diagnosis!.confidence === "high" && patchAttempts.length >= 2 ? "rollback" : "retry";

  return { strategy, recoveryIteration: nextIteration };
}
