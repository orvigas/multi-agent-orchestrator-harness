import fs from "node:fs";
import path from "node:path";
import { buildContextBlock } from "../../../config/loadContext.js";
import { extractForbiddenPatterns, matchesForbiddenPattern } from "../../../config/forbiddenZones.js";
import type { ImplementationStateType } from "../state.js";
import type { Patch, PatchHunk } from "../types.js";

const CONTEXT_LINES = 2;

// Stand-in determinista para el rol "implementer": no escribe código nuevo,
// solo agrega un comentario TODO trazable — real hunk basado en contexto
// (líneas reales del archivo, nunca números de línea), aplicado y
// verificado de verdad en applyInSandbox/quickCheck. Lo que sí es real: el
// chequeo de forbidden-zones contra .harness/rules real (Capa 1).
function buildHunkForFile(file: string, taskId: string): PatchHunk | null {
  const absPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(absPath)) return null;

  const lines = fs.readFileSync(absPath, "utf8").split("\n");
  const lastLineIndex = lines.length - 1;
  const contextBefore = lines.slice(Math.max(0, lastLineIndex - CONTEXT_LINES), lastLineIndex);
  const lastLine = lines[lastLineIndex];

  return {
    file,
    contextBefore,
    oldLines: [lastLine],
    newLines: [lastLine, `// TODO(task ${taskId}): revisar según el plan generado.`],
    contextAfter: [],
  };
}

function finalize(state: ImplementationStateType, patch: Patch) {
  const iteration = state.iteration + 1;
  return {
    patch,
    iteration,
    patchAttempts: [{ iteration, patch, quickCheckResult: null }],
  };
}

export function generatePatchNode(state: ImplementationStateType) {
  const task = state.task;
  const lastAttempt = state.patchAttempts.slice(-1)[0];
  const feedback =
    lastAttempt?.quickCheckResult && !lastAttempt.quickCheckResult.passed
      ? lastAttempt.quickCheckResult.detail
      : null;

  if (!task) {
    return finalize(state, { taskId: "unknown", hunks: [], rationale: "No hay task; patch vacío." });
  }

  // Regla dura (rules.forbidden-zones): si la task tocaría una zona
  // prohibida, nunca se genera el patch.
  const forbiddenPatterns = extractForbiddenPatterns(buildContextBlock("rules"));
  const forbiddenFile = task.touchesFiles.find((file) =>
    forbiddenPatterns.some((p) => matchesForbiddenPattern(file, p))
  );
  if (forbiddenFile) {
    return finalize(state, {
      taskId: task.id,
      hunks: [],
      rationale:
        `La task requeriría tocar "${forbiddenFile}", zona prohibida por .harness/rules/forbidden-zones.md. ` +
        "No se genera patch; el Orchestrator debe escalar.",
    });
  }

  if (task.touchesFiles.length === 0) {
    return finalize(state, {
      taskId: task.id,
      hunks: [],
      rationale: "La task no toca archivos (p. ej. una task de mitigación de riesgo); nada que parchear.",
    });
  }

  const hunks = task.touchesFiles
    .map((file) => buildHunkForFile(file, task.id))
    .filter((h): h is PatchHunk => h !== null);

  const rationale = feedback
    ? `Intento previo falló (${feedback}); se reintenta el mismo cambio mínimo sobre ${hunks.length} archivo(s).`
    : `Agrega un comentario TODO trazable a la task en ${hunks.length} archivo(s) tocado(s), sin alterar comportamiento.`;

  return finalize(state, { taskId: task.id, hunks, rationale });
}
