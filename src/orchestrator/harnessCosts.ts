import fs from "node:fs";
import { parseArgs } from "node:util";
import { loadOrchestratorConfig } from "../config/loadOrchestratorConfig.js";
import { summarizeTokenUsageByLayer } from "../services/tokenTracking.js";
import type { RunLogEntry } from "./runLog.js";
import type { TokenUsageEvent } from "../services/tokenTracking.js";

// Sustituye a "npm run harness:costs --days=N" / analyze-harness-costs del
// análisis de gaps — ese paquete npm no existe en el registry. El coste que
// suma es SIMULADO (ver runLog.ts / src/orchestrator/nodes/implementation.ts),
// nunca un cobro real de un provider — se lo etiqueta explícito abajo.
const { values } = parseArgs({ options: { days: { type: "string", default: "7" } } });
const days = Number(values.days);

const logPath = loadOrchestratorConfig().orchestrator.runLogPath;
if (!fs.existsSync(logPath)) {
  console.log(`Sin corridas registradas todavía (${logPath} no existe).`);
  process.exit(0);
}

const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
const lines = fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean);
const entries = lines
  .map((line) => JSON.parse(line) as RunLogEntry)
  .filter((e) => new Date(e.timestamp).getTime() >= cutoff);

const totalTokens = entries.reduce((sum, e) => sum + e.tokenBudget.used, 0);
const totalCostUsd = entries.reduce((sum, e) => sum + e.costBudget.usedUsd, 0);

// Phase 1.3: Collect all token events across runs (if available)
const allTokenEvents: TokenUsageEvent[] = entries.flatMap((e) => (e as any).tokenEvents ?? []);
const layerSummary = summarizeTokenUsageByLayer(allTokenEvents);

console.log(`Corridas en los últimos ${days} día(s): ${entries.length}`);
console.log(`Tokens (simulados): ${totalTokens}`);
console.log(`Costo (simulado): $${totalCostUsd.toFixed(4)}`);

// Show breakdown by layer if events are available
if (layerSummary.length > 0) {
  console.log("\n=== Desglose de tokens por capa ===");
  for (const layer of layerSummary) {
    const percent = ((layer.totalTokens / totalTokens) * 100).toFixed(1);
    console.log(`${layer.layer}: ${layer.totalTokens} tokens (${percent}%, ${layer.eventCount} eventos)`);
  }
}

console.log(
  "\nNota: este costo es un placeholder (SIMULATED_TOKENS_PER_TASK / SIMULATED_COST_USD_PER_TASK) — " +
    "ningún nodo de este harness llama a un LLM real todavía."
);
