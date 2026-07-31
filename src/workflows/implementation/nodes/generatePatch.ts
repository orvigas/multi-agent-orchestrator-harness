import fs from "node:fs";
import path from "node:path";
import { callLLM, HARNESS_MODE } from "../../../services/llm.js";
import { buildContextBlock } from "../../../config/loadContext.js";
import { extractForbiddenPatterns, matchesForbiddenPattern } from "../../../config/forbiddenZones.js";
import { validatePatch, formatValidationResult } from "../tools/patchValidator.js";
import { recordTokenUsage } from "../../../services/tokenTracking.js";
import type { ImplementationStateType } from "../state.js";
import type { Patch, PatchHunk } from "../types.js";

const CONTEXT_LINES = 2;

// Stand-in determinista para el rol "implementer": no escribe código nuevo,
// solo agrega un comentario TODO trazable — real hunk basado en contexto
// (líneas reales del archivo, nunca números de línea), aplicado y
// verificado de verdad en applyInSandbox/quickCheck. Lo que sí es real: el
// chequeo de forbidden-zones contra .harness/rules real (Capa 1).
function buildHunkForFile(file: string, taskId: string, targetPath: string): PatchHunk | null {
  const absPath = path.resolve(targetPath, file);
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

export async function generatePatchNode(state: ImplementationStateType) {
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

  // Modo LLM: pedir a Claude que genere el patch (Phase 2.1 with safety checks)
  if (HARNESS_MODE === "llm" && state.config) {
    try {
      const fileContents: Record<string, string> = {};
      for (const file of task.touchesFiles) {
        const absPath = path.resolve(state.targetPath, file);
        if (fs.existsSync(absPath)) {
          fileContents[file] = fs.readFileSync(absPath, "utf8");
        }
      }

      const userPrompt = `
Task: ${task.description}

CRITICAL: Generate ONLY context-based patches (never line numbers).
Each hunk MUST have both contextBefore AND contextAfter to ensure precise matching.
Context lines are real lines from the file that will be used to locate the change.

Files to modify:
${task.touchesFiles.map((f) => `- ${f}`).join("\n")}

File contents:
${Object.entries(fileContents)
  .map(([file, content]) => `\n### ${file}\n\`\`\`\n${content}\n\`\`\``)
  .join("\n")}

${feedback ? `\nPrevious attempt failed: ${feedback}\nPlease fix the issue.` : ""}

Generate a JSON patch with this structure:
{
  "hunks": [
    {
      "file": "path/to/file",
      "contextBefore": ["line that comes before the change"],
      "oldLines": ["line to replace"],
      "newLines": ["replacement line"],
      "contextAfter": ["line that comes after the change"]
    }
  ],
  "rationale": "Brief explanation of why this patch solves the task"
}

IMPORTANT:
- contextBefore and contextAfter MUST be non-empty (provide actual lines from file)
- oldLines and newLines are the actual content to change
- Return ONLY the JSON, no other text
`;

      const response = await callLLM(
        {
          role: "implementer",
          systemPrompt: buildContextBlock("rules", state.targetPath),
          userPrompt,
          temperature: 0.1,
          maxTokens: 4000,
        },
        state.config
      );

      const patchJson = JSON.parse(response.content);
      const patch: Patch = {
        taskId: task.id,
        hunks: patchJson.hunks || [],
        rationale: patchJson.rationale || "Generated by LLM implementer",
      };

      // Phase 2.1: Comprehensive patch validation (safety checks)
      const validationResult = validatePatch(patch, state.targetPath);

      if (!validationResult.valid) {
        // Validation failed — reject patch and report errors
        console.error("LLM patch validation failed:\n" + formatValidationResult(validationResult));
        const errorSummary = validationResult.errors.slice(0, 3).join("; ");
        return finalize(state, {
          taskId: task.id,
          hunks: [],
          rationale: `LLM patch rejected by safety validation: ${errorSummary}. Falling back to heuristic.`,
        });
      }

      // Log any warnings (valid but suspicious)
      if (validationResult.warnings.length > 0) {
        console.warn("LLM patch validation warnings:\n" + validationResult.warnings.join("\n"));
      }

      // Record token usage for Phase 1.3 (actual tokens from LLM)
      // Phase 2.2: Include provider/model info for cost tracking
      const tokenEvent = recordTokenUsage(
        "implementation",
        "patch_generation",
        `LLM-generated patch for task ${task.id} (passed safety validation)`,
        task.id,
        {
          hunksCount: patch.hunks.length,
          filesModified: [...new Set(patch.hunks.map((h) => h.file))].length,
          tokensUsed: response.totalTokens,
          provider: response.provider,       // Phase 2.2
          model: response.model,              // Phase 2.2
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        }
      );

      return {
        ...finalize(state, patch),
        tokenEvents: [tokenEvent],
      };
    } catch (err) {
      // Fallback a heurística si LLM falla
      console.error("LLM patch generation failed:", err);
    }
  }

  // Modo determinístico o fallback: usar heurística
  const hunks = task.touchesFiles
    .map((file) => buildHunkForFile(file, task.id, state.targetPath))
    .filter((h): h is PatchHunk => h !== null);

  const rationale = feedback
    ? `Intento previo falló (${feedback}); se reintenta el mismo cambio mínimo sobre ${hunks.length} archivo(s).`
    : `Agrega un comentario TODO trazable a la task en ${hunks.length} archivo(s) tocado(s), sin alterar comportamiento.`;

  return finalize(state, { taskId: task.id, hunks, rationale });
}
