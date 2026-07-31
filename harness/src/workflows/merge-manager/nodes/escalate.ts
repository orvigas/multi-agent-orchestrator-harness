import fs from "node:fs";
import path from "node:path";
import { loadMergeManagerConfig } from "../../../config/loadMergeManagerConfig.js";
import type { MergeManagerStateType } from "../state.js";

// Reemplaza notifyOperations (Slack/PagerDuty) del how-to §3: sin
// credenciales reales configuradas para esos servicios, un reporte local es
// lo único que este harness puede hacer honestamente. Gobernanza: los
// conflictos SIEMPRE escalan (nunca se autoresuelven) — este archivo es la
// cola de revisión manual.
export function escalateNode(state: MergeManagerStateType): { escalationReason: string } {
  const config = loadMergeManagerConfig();
  const reason = `Conflicto de merge irresoluble en: ${state.conflictReport?.files.join(", ") ?? "(sin detalle)"}`;

  const dir = config.mergeManager.escalationDir;
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `${state.task?.id ?? "unknown-task"}-${Date.now()}.json`;
  const report = {
    taskId: state.task?.id ?? null,
    reason,
    conflictFiles: state.conflictReport?.files ?? [],
    patchRationale: state.patch?.rationale ?? null,
    targetPath: state.targetPath,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(report, null, 2));

  return { escalationReason: reason };
}
