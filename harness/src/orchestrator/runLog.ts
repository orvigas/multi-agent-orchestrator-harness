import fs from "node:fs";
import path from "node:path";
import type { OrchestratorRuntimeConfig } from "../config/loadOrchestratorConfig.js";
import type { OrchestratorStateType } from "./state.js";

// Mismo patrón que src/workflows/merge-manager/releaseLog.ts: log local
// append-only, un JSON por corrida completa (no por ticket ni por nodo —
// decisionLog ya tiene ese detalle adentro). Reemplaza el "IG §6.7.2/§6.6"
// del análisis de gaps (LangSmith + analyze-harness-costs) con algo
// verificable sin credenciales ni paquetes que no existen en el registry.
export interface RunLogEntry {
  threadId: string;
  timestamp: string;
  ticketsDone: number;
  ticketsBlocked: number;
  ticketsPending: number;
  tokenBudget: { limit: number; used: number };
  costBudget: { limitUsd: number; usedUsd: number };
  // El coste es SIMULADO (SIMULATED_TOKENS_PER_TASK/SIMULATED_COST_USD_PER_TASK
  // en src/orchestrator/nodes/implementation.ts) — nunca un LLM real cobró
  // esto. Se etiqueta acá para que harness:costs no lo reporte como gasto real.
  costIsSimulated: true;
  decisionLog: OrchestratorStateType["decisionLog"];
}

export function appendRunLogEntry(
  threadId: string,
  finalState: OrchestratorStateType,
  config: OrchestratorRuntimeConfig
): RunLogEntry {
  const logPath = config.orchestrator.runLogPath;
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const entry: RunLogEntry = {
    threadId,
    timestamp: new Date().toISOString(),
    ticketsDone: finalState.backlog.filter((t) => t.status === "done").length,
    ticketsBlocked: finalState.backlog.filter((t) => t.status === "blocked").length,
    ticketsPending: finalState.backlog.filter((t) => (t.status ?? "pending") === "pending").length,
    tokenBudget: finalState.tokenBudget,
    costBudget: finalState.costBudget,
    costIsSimulated: true,
    decisionLog: finalState.decisionLog,
  };

  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
  return entry;
}
