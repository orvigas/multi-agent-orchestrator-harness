import { recoveryWorkflow } from "../../workflows/recovery/graph.js";
import { loadRecoveryConfig } from "../../config/loadRecoveryConfig.js";
import { decisionEntry } from "../decisionLog.js";
import type { OrchestratorStateType } from "../state.js";

// Adaptador entre OrchestratorState y RecoveryState (mismo patrón que los
// adaptadores de Knowledge Engine/Planner/Implementation): schemas
// distintos, así que se invoca el subgrafo manualmente y se traduce el
// resultado. A diferencia de esos otros tres, recoveryHistory viaja EN AMBAS
// direcciones sin resetearse — es memoria a nivel de ticket, no de esta
// única invocación (por eso vive en OrchestratorState, no solo en
// RecoveryState).
export async function recoveryNode(state: OrchestratorStateType) {
  const ticket = state.currentTicket;
  if (!ticket) {
    return { decisionLog: [decisionEntry("recovery", "Sin currentTicket; nada que diagnosticar.")] };
  }

  const failedTask = state.failedTaskId
    ? (state.plan?.tasks.find((t) => t.id === state.failedTaskId) ?? null)
    : null;

  const result = await recoveryWorkflow.invoke({
    failureCategory: state.failureCategory,
    validationEvidence: state.validationEvidence,
    patchAttempts: state.patchAttempts,
    qualityGateIssues: state.qualityGateIssues,
    mergeConflict: state.mergeConflict,
    recoveryHistory: state.recoveryHistory,
    failedTask,
    failedSandboxPath: state.failedSandboxPath,
    recoveryIteration: state.retryCount,
    maxRecoveryIterations: state.maxRetries,
  });

  const base = {
    strategy: result.strategy,
    retryCount: state.retryCount + 1,
    recoveryHistory: result.recoveryHistory,
    // ya se consumió para este diagnóstico — una falla nueva la vuelve a
    // poblar desde implementation.ts si corresponde.
    qualityGateIssues: [],
    mergeConflict: null,
    decisionLog: [
      decisionEntry(
        "recovery",
        `Ticket ${ticket.id}: rootCause=${result.diagnosis?.rootCause ?? "?"} ` +
          `(confidence=${result.diagnosis?.confidence ?? "?"}, repetido=${result.diagnosis?.isRepeatedFailure ?? false}) ` +
          `-> estrategia "${result.strategy}".`
      ),
    ],
  };

  if (result.strategy === "rollback") {
    // "Time travel" real de este harness (ver ADR de la Capa 1: MemorySaver,
    // no PostgresSaver): en vez de invocar el checkpointer de LangGraph a
    // bajo nivel, el adaptador simplemente descarta el plan actual — Planning
    // lo regenera desde cero la próxima vez que corra. prepareRollbackNode ya
    // limpió el sandbox del intento fallido.
    return { ...base, plan: null, failedTaskId: null, targetedFixTask: null, failedSandboxPath: null };
  }

  if (result.strategy === "change_context") {
    // Vuelve a Planning con un plan nuevo — el failedTaskId/targetedFixTask
    // del plan VIEJO ya no aplican, pero recoveryHistory sí persiste (es
    // literalmente la memoria que evita repetir el cambio de contexto en vano).
    return { ...base, failedTaskId: null, targetedFixTask: null };
  }

  if (result.strategy === "change_model") {
    const config = loadRecoveryConfig();
    const fallbacks = config.recovery.fallbackModelsForImplementer;
    const nextIndex = state.implementerFallbackIndex % Math.max(fallbacks.length, 1);
    const nextModel = fallbacks[nextIndex];

    return {
      ...base,
      implementerFallbackIndex: state.implementerFallbackIndex + 1,
      config: nextModel && state.config
        ? { ...state.config, roles: { ...state.config.roles, implementer: nextModel } }
        : state.config,
      targetedFixTask: result.targetedFixTask,
    };
  }

  // retry / partial_retry: reintenta la MISMA task, ahora acotada por
  // targetedFixTask (nunca "regenera todo" — ver prepareFixNode).
  return { ...base, targetedFixTask: result.targetedFixTask };
}
