import fs from "node:fs";
import path from "node:path";
import type { MergeManagerConfig } from "../../config/loadMergeManagerConfig.js";
import type { Ticket } from "../../orchestrator/types.js";
import type { ReleaseLogEntry } from "./types.js";

// "git tag" sin git (how-to §3 gitTag.ts): un log local append-only en vez de
// un tag real. Bookkeeping a nivel de TICKET (no de task, como el resto de
// este subgrafo) — por eso vive acá como función simple, no como nodo de
// mergeManagerWorkflow (mismo tipo de gap de granularidad que Quality Gate ya
// resolvió: el how-to mezcla estado singular con lógica que en realidad opera
// sobre el plan completo).
//
// Solo tagNamingStrategy "auto-increment" tiene comportamiento real — el
// how-to menciona "semver" pero nunca lo implementa ("detalles omitidos por
// brevedad"); tampoco se implementa acá.
// dryRun se recibe explícito (el valor REALMENTE usado al promover cada
// task), no se relee de config: quien llama (implementationNode) ya sabe con
// qué dryRun corrió cada mergeManagerWorkflow.invoke — releerlo de config acá
// asumiría que siempre coincide, lo cual ni siquiera es cierto en el propio
// demo (que fuerza dryRun:false para mostrar una promoción real aunque el
// config del proyecto traiga dryRun:true).
export function appendReleaseLogEntry(
  ticket: Ticket,
  taskIds: string[],
  dryRun: boolean,
  config: MergeManagerConfig
): ReleaseLogEntry {
  const logPath = config.mergeManager.releaseLogPath;
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const existingLines = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean).length
    : 0;

  const entry: ReleaseLogEntry = {
    tag: `release-${existingLines + 1}`,
    ticketId: ticket.id,
    taskIds,
    dryRun,
    timestamp: new Date().toISOString(),
  };

  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
  return entry;
}
