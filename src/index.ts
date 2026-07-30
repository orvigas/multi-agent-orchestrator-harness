import fs from "node:fs";
import { parseArgs } from "node:util";
import { orchestrator } from "./orchestrator/graph.js";
import { loadOrchestratorConfig } from "./config/loadOrchestratorConfig.js";
import { appendRunLogEntry } from "./orchestrator/runLog.js";
import type { OrchestratorStateType } from "./orchestrator/state.js";
import type { Ticket } from "./orchestrator/types.js";

const demoBacklog: Ticket[] = [
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

// CLI local (sin webhooks ni tracker externo — ver categoría 3 del análisis
// de gaps): --ticket-id/--title/--description arma un backlog de un solo
// ticket ad-hoc; --backlog apunta a un JSON con un array de Ticket[]. Sin
// ninguno de los dos, corre el backlog de demo de siempre (comportamiento
// de "npm run dev" sin cambios).
const { values: cliArgs } = parseArgs({
  options: {
    "ticket-id": { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    backlog: { type: "string" },
  },
  allowPositionals: false,
});

function resolveBacklog(): Ticket[] {
  if (cliArgs.backlog) {
    const raw = fs.readFileSync(cliArgs.backlog, "utf8");
    return JSON.parse(raw) as Ticket[];
  }
  if (cliArgs["ticket-id"]) {
    return [
      {
        id: cliArgs["ticket-id"],
        title: cliArgs.title ?? cliArgs["ticket-id"],
        description: cliArgs.description,
        status: "pending",
      },
    ];
  }
  return demoBacklog;
}

const orchestratorConfig = loadOrchestratorConfig();

const initialState: Partial<OrchestratorStateType> = {
  backlog: resolveBacklog(),
  maxRetries: 3,
  // deadline: antes calculado en ningún lado — deadlineMinutes de
  // config/orchestrator.yml era config muerta (state.ts default a null y
  // nada más lo poblaba). routeAfterBudgetCheck ya sabía leerlo.
  deadline: new Date(Date.now() + orchestratorConfig.orchestrator.deadlineMinutes * 60_000).toISOString(),
};

// Con la Capa 5 real activa, un ticket cuya Validation Pipeline falla de
// forma determinista (p. ej. una vulnerabilidad real en una dependencia
// transitiva — ver npm audit) agota sus 3 reintentos de Recovery antes de
// que abortTicketNode lo marque "blocked" y siga con el resto del backlog
// (ver src/orchestrator/nodes/abortTicket.ts). Eso implica más pasos por
// ticket que el límite de recursión por defecto (25) de LangGraph.
// thread_id único por invocación: MemorySaver de todos modos no persiste
// entre procesos (ADR 0001), pero un thread_id fijo haría que cada línea de
// runLog fuera indistinguible de la anterior.
const threadId = `run-${Date.now()}`;
const config = { configurable: { thread_id: threadId }, recursionLimit: 100 };

const finalState = await orchestrator.invoke(initialState, config);
appendRunLogEntry(threadId, finalState, orchestratorConfig);

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
