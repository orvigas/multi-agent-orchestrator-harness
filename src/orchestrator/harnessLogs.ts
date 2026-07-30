import fs from "node:fs";
import { loadOrchestratorConfig } from "../config/loadOrchestratorConfig.js";
import type { RunLogEntry } from "./runLog.js";

// Lee .harness/runs.jsonl (ver runLog.ts) y reimprime el decision log de
// cada corrida en el mismo formato que ya usa src/index.ts al final de un
// run — sustituye a "npm run harness:logs --follow" del análisis de gaps
// sin necesitar un proceso corriendo en segundo plano ni LangSmith.
const logPath = loadOrchestratorConfig().orchestrator.runLogPath;

if (!fs.existsSync(logPath)) {
  console.log(`Sin corridas registradas todavía (${logPath} no existe).`);
  process.exit(0);
}

const lines = fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean);

for (const line of lines) {
  const entry = JSON.parse(line) as RunLogEntry;
  console.log(
    `\n=== ${entry.threadId} (${entry.timestamp}) — done=${entry.ticketsDone} blocked=${entry.ticketsBlocked} pending=${entry.ticketsPending} ===`
  );
  for (const decision of entry.decisionLog) {
    console.log(`[${decision.timestamp}] (${decision.node}) ${decision.message}`);
  }
}
