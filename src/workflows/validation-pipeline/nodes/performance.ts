import { loadValidationPipelineConfig } from "../../../config/loadValidationPipelineConfig.js";
import { runCommand, truncate } from "../tools/exec.js";
import type { ValidationStateType } from "../state.js";
import type { StageResult } from "../types.js";

// Gobernanza (sección 6 del how-to): performance no corre gratis en cada
// patch. Solo se activa si config.performance.enabled es true globalmente,
// o si esta task en particular es de riesgo medio/alto (Discovery, Capa 3).
export async function performanceNode(state: ValidationStateType): Promise<{ results: StageResult[] }> {
  const config = loadValidationPipelineConfig();
  const riskWarrantsIt = state.task?.riskLevel === "medium" || state.task?.riskLevel === "high";

  if (!config.validation.performance.enabled && !riskWarrantsIt) {
    return {
      results: [
        {
          stage: "performance",
          passed: true,
          durationMs: 0,
          evidence: "no aplica: performance deshabilitado globalmente y la task no es de riesgo medio/alto",
          exitCode: 0,
        },
      ],
    };
  }

  const start = Date.now();
  const { exitCode, stdout, stderr, timedOut } = await runCommand(config.validation.performance.command, {
    cwd: state.sandboxPath,
    timeoutMs: config.validation.timeouts.performanceMs,
  });

  return {
    results: [
      {
        stage: "performance",
        passed: exitCode === 0,
        durationMs: Date.now() - start,
        evidence: timedOut ? "timeout" : truncate(stdout + stderr, 4000),
        exitCode,
      },
    ],
  };
}
