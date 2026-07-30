import type { OrchestratorStateType } from "../state.js";

export function routeAfterBudgetCheck(state: OrchestratorStateType): "continue" | "stop" {
  const { tokenBudget, costBudget, deadline, currentTicket } = state;

  if (!currentTicket) return "stop"; // backlog agotado
  if (tokenBudget.used >= tokenBudget.limit) return "stop";
  if (costBudget.usedUsd >= costBudget.limitUsd) return "stop";
  if (deadline && Date.now() >= new Date(deadline).getTime()) return "stop";

  return "continue";
}

export function routeAfterImplementation(state: OrchestratorStateType): "pass" | "fail" {
  return state.lastImplementationResult === "pass" ? "pass" : "fail";
}

export function routeAfterRecovery(
  state: OrchestratorStateType
): "abort" | "change_model" | "retry_planning" | "retry_implementation" {
  if (state.strategy === "abort") return "abort";
  if (state.strategy === "change_model") return "change_model";
  if (state.strategy === "rollback" || state.strategy === "change_context") {
    // rollback == volver a un checkpoint anterior; LangGraph lo soporta nativo
    // via graph.updateState() + time travel sobre el checkpointer
    return "retry_planning";
  }
  if (state.retryCount >= state.maxRetries) return "abort";
  return "retry_implementation";
}
