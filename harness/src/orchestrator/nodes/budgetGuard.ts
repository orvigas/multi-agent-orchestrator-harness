import { decisionEntry } from "../decisionLog.js";
import type { OrchestratorStateType } from "../state.js";

// Nodo de solo lectura: no muta presupuestos, solo dejar constancia del
// chequeo en el decisionLog. La decisión real (continuar/parar) vive en
// routeAfterBudgetCheck, la conditional edge que sigue a este nodo.
export function budgetGuardNode(state: OrchestratorStateType) {
  const { tokenBudget, costBudget, deadline } = state;
  return {
    decisionLog: [
      decisionEntry(
        "budget_guard",
        `tokens ${tokenBudget.used}/${tokenBudget.limit}, costo $${costBudget.usedUsd}/$${costBudget.limitUsd}, deadline ${deadline ?? "sin límite"}`
      ),
    ],
  };
}
