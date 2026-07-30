import { loadValidationPipelineConfig, type ValidationPipelineConfig } from "../../../config/loadValidationPipelineConfig.js";
import { runCommand, truncate } from "../tools/exec.js";
import type { ValidationStateType } from "../state.js";
import type { Stage, StageResult } from "../types.js";

// compile/tests/lint/static_analysis/security comparten exactamente el
// mismo contrato (doc sección 4: "la simetría es intencional"): correr un
// comando configurado y registrar un StageResult. Esta fábrica es esa
// simetría hecha explícita en vez de cinco copias del mismo cuerpo.
export function makeStageNode(
  stage: Stage,
  getCommand: (config: ValidationPipelineConfig) => string,
  getTimeoutMs: (config: ValidationPipelineConfig) => number,
  maxEvidenceChars = 4000
) {
  return async (state: ValidationStateType): Promise<{ results: StageResult[] }> => {
    const config = loadValidationPipelineConfig();
    const start = Date.now();
    const { exitCode, stdout, stderr, timedOut } = await runCommand(getCommand(config), {
      cwd: state.sandboxPath,
      timeoutMs: getTimeoutMs(config),
    });

    return {
      results: [
        {
          stage,
          passed: exitCode === 0,
          durationMs: Date.now() - start,
          evidence: timedOut ? "timeout" : truncate(stdout + stderr, maxEvidenceChars),
          exitCode,
        },
      ],
    };
  };
}
