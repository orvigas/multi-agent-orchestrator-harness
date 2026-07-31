import { decisionEntry } from "../decisionLog.js";
import type { OrchestratorStateType } from "../state.js";

export function selectNextTicketNode(state: OrchestratorStateType) {
  const next = state.backlog.find((t) => (t.status ?? "pending") === "pending");

  if (!next) {
    return {
      currentTicket: null,
      decisionLog: [decisionEntry("select_next_ticket", "No quedan tickets pendientes en el backlog.")],
    };
  }

  const backlog = state.backlog.map((t) =>
    t.id === next.id ? { ...t, status: "in_progress" as const } : t
  );

  return {
    backlog,
    currentTicket: { ...next, status: "in_progress" as const },
    // Un ticket nuevo empieza con presupuesto y memoria de recovery
    // limpios, sin importar cómo terminó el ticket anterior (pass,
    // blocked, o un recovery exitoso a mitad de camino que dejó
    // retryCount > 0). Centralizado acá en vez de en cada camino de
    // salida del ticket previo (menos fácil de olvidar un caso).
    retryCount: 0,
    failureCategory: null,
    validationEvidence: [],
    patchAttempts: [],
    recoveryHistory: [],
    failedTaskId: null,
    targetedFixTask: null,
    failedSandboxPath: null,
    implementerFallbackIndex: 0,
    qualityGateIssues: [],
    mergeConflict: null,
    decisionLog: [decisionEntry("select_next_ticket", `Ticket seleccionado: ${next.id} - ${next.title}`)],
  };
}
