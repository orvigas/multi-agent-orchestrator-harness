import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { initializeOrchestrator, orchestrator as getOrchestrator } from "./orchestrator/graph.js";
import { validateCheckpointer } from "./persistence/checkpointer.js";
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
// ticket ad-hoc; --backlog apunta a un JSON con un array de Ticket[];
// --target apunta al repo a procesar (default: cwd). Sin ninguno de los dos,
// corre el backlog de demo de siempre contra el harness actual.
const { values: cliArgs } = parseArgs({
  options: {
    "ticket-id": { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    backlog: { type: "string" },
    target: { type: "string" },
  },
  allowPositionals: false,
});

export function resolveTargetPath(target?: string): string {
  if (!target) {
    return process.cwd();
  }

  const targetPath = path.resolve(target);

  // Validar que existe
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target repo not found: ${targetPath}`);
  }

  // Validar que es un directorio
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    throw new Error(`Target is not a directory: ${targetPath}`);
  }

  return targetPath;
}

export function resolveBacklog(ticketId?: string, title?: string, description?: string, backlogFile?: string): Ticket[] {
  if (backlogFile) {
    const raw = fs.readFileSync(backlogFile, "utf8");
    return JSON.parse(raw) as Ticket[];
  }
  if (ticketId) {
    return [
      {
        id: ticketId,
        title: title ?? ticketId,
        description: description,
        status: "pending",
      },
    ];
  }
  return demoBacklog;
}

async function main() {
  const orchestratorConfig = loadOrchestratorConfig();

  // Inicializar checkpoint database (SQLite)
  console.log("🔧 Initializing checkpoint database...");
  const validation = await validateCheckpointer();
  if (!validation.success) {
    console.error(`❌ Checkpoint database error: ${validation.error}`);
    process.exit(1);
  }
  console.log(`✅ Checkpoint database ready: ${validation.path}`);

  // Inicializar orchestrator con SQLite checkpointer
  console.log("🚀 Initializing Orchestrator...");
  await initializeOrchestrator();

  let targetPath: string;
  try {
    targetPath = resolveTargetPath(cliArgs.target);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  const initialState: Partial<OrchestratorStateType> = {
    targetPath,
    backlog: resolveBacklog(
      cliArgs["ticket-id"],
      cliArgs.title,
      cliArgs.description,
      cliArgs.backlog
    ),
    maxRetries: 3,
    deadline: new Date(Date.now() + orchestratorConfig.orchestrator.deadlineMinutes * 60_000).toISOString(),
  };

  const threadId = `run-${Date.now()}`;
  const config = { configurable: { thread_id: threadId }, recursionLimit: 100 };

  const orchestrator = getOrchestrator;
  if (!orchestrator) {
    console.error("❌ Orchestrator initialization failed");
    process.exit(1);
  }

  console.log("🎯 Starting Orchestrator...\n");
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
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
