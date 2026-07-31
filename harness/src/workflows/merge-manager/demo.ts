import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mergeManagerWorkflow } from "./graph.js";
import { appendReleaseLogEntry } from "./releaseLog.js";
import { loadMergeManagerConfig } from "../../config/loadMergeManagerConfig.js";
import type { Patch } from "../implementation/types.js";
import type { PlanTask } from "../planner/types.js";
import type { Ticket } from "../../orchestrator/types.js";

// Directorio descartable propio del demo — NUNCA el proyecto real ni
// process.cwd(). A diferencia de Implementation Loop/Quality Gate (que
// sandboxean UNA COPIA de este proyecto para probar patches sobre código
// real), Merge Manager promueve contra un "árbol real" — así que el demo
// necesita su propio árbol real de juguete para no arriesgar el repo.
function makeScratchTarget(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merge-manager-demo-"));
  fs.writeFileSync(path.join(dir, "widget.ts"), "export function widget() {\n  return 1;\n}\n");
  return dir;
}

function widgetPatch(taskId: string): Patch {
  return {
    taskId,
    rationale: "aumentar el valor devuelto por widget()",
    hunks: [
      {
        file: "widget.ts",
        contextBefore: ["export function widget() {"],
        oldLines: ["  return 1;"],
        newLines: ["  return 2;"],
        contextAfter: ["}"],
      },
    ],
  };
}

// Escenario 1: patch limpio -> sin conflicto -> promovido de VERDAD (dryRun
// desactivado a propósito para este demo, aunque config/merge-manager.yml
// traiga dryRun:true para el Orchestrator real) contra el árbol de juguete.
{
  console.log("\n=== Escenario 1: patch limpio, promoción real contra un árbol de juguete ===");
  const target = makeScratchTarget();
  const task: PlanTask = { id: "mm-demo-1", description: "Ajustar widget()", touchesFiles: ["widget.ts"] };
  const patch = widgetPatch("mm-demo-1");

  console.log(`Target: ${target}`);
  const result = await mergeManagerWorkflow.invoke({ task, patch, targetPath: target, dryRun: false });
  console.log(`Conflicto: ${result.conflictReport?.hasConflicts}`);
  console.log(`Promovido: ${result.promoted}`);
  console.log(`Contenido final: ${fs.readFileSync(path.join(target, "widget.ts"), "utf8").trim()}`);

  const ticket: Ticket = { id: "T-mm-demo-1", title: "Demo ticket 1" };
  const entry = appendReleaseLogEntry(ticket, [task.id], false, loadMergeManagerConfig());
  console.log(`Release log: ${JSON.stringify(entry)}`);
}

// Escenario 2: el archivo destino cambia DESPUÉS de que el patch fue
// generado (simula que algo más tocó ese archivo real mientras tanto) ->
// conflicto real detectado sin git -> escala (nunca autoresuelve).
{
  console.log("\n=== Escenario 2: el archivo destino divergió -> conflicto real -> escalación ===");
  const target = makeScratchTarget();
  const task: PlanTask = { id: "mm-demo-2", description: "Ajustar widget() (va a conflictuar)", touchesFiles: ["widget.ts"] };
  const patch = widgetPatch("mm-demo-2");

  // Simula divergencia real: el árbol cambió después de que el patch se
  // generó contra el snapshot original.
  fs.writeFileSync(path.join(target, "widget.ts"), "export function widget() {\n  return 999; // cambiado por otra parte\n}\n");

  console.log(`Target: ${target}`);
  const result = await mergeManagerWorkflow.invoke({ task, patch, targetPath: target, dryRun: false });
  console.log(`Conflicto: ${result.conflictReport?.hasConflicts} (archivos: ${result.conflictReport?.files.join(", ")})`);
  console.log(`Escalación: ${result.escalationReason}`);
  console.log(`Reporte escrito en: ${loadMergeManagerConfig().mergeManager.escalationDir}`);
}
