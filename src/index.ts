import { orchestrator } from "./orchestrator/graph.js";
import type { OrchestratorStateType } from "./orchestrator/state.js";
import type { Ticket } from "./orchestrator/types.js";

const backlog: Ticket[] = [
  {
    id: "T-1",
    title: "Revisar cómo routeAfterBudgetCheck decide detener el Orchestrator",
    description: "Cubrir el caso de `deadline` vencido en `routeAfterBudgetCheck`.",
    status: "pending",
  },
  {
    id: "T-2",
    title: "Documentar quién llama a selectNextTicketNode",
    description: "Entender cómo `selectNextTicketNode` actualiza el backlog antes de tocarlo.",
    status: "pending",
  },
  {
    id: "T-3",
    title: "Extender buildContextBlock para un cuarto tipo de contexto",
    description: "Ver quién usa `buildContextBlock` hoy antes de agregarle un parámetro nuevo.",
    status: "pending",
  },
];

const initialState: Partial<OrchestratorStateType> = {
  backlog,
  maxRetries: 3,
  tokenBudget: { limit: 200_000, used: 0 },
  costBudget: { limitUsd: 5, usedUsd: 0 },
};

// Con la Capa 5 real activa, un ticket cuya Validation Pipeline falla de
// forma determinista (p. ej. una vulnerabilidad real en una dependencia
// transitiva — ver npm audit) agota sus 3 reintentos de Recovery antes de
// que abortTicketNode lo marque "blocked" y siga con el resto del backlog
// (ver src/orchestrator/nodes/abortTicket.ts). Eso implica más pasos por
// ticket que el límite de recursión por defecto (25) de LangGraph.
const config = { configurable: { thread_id: "demo-run" }, recursionLimit: 100 };

const finalState = await orchestrator.invoke(initialState, config);

console.log("=== Decision log ===");
for (const entry of finalState.decisionLog) {
  console.log(`[${entry.timestamp}] (${entry.node}) ${entry.message}`);
}

console.log("\n=== Backlog final ===");
for (const ticket of finalState.backlog) {
  console.log(`${ticket.id} [${ticket.status}] ${ticket.title}`);
}

console.log("\n=== Presupuesto final ===");
console.log(
  `tokens: ${finalState.tokenBudget.used}/${finalState.tokenBudget.limit}, costo: $${finalState.costBudget.usedUsd}/$${finalState.costBudget.limitUsd}`
);
