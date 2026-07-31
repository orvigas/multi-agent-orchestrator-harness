import { runCommand } from "../../validation-pipeline/tools/exec.js";
import { loadQualityGateConfig } from "../../../config/loadQualityGateConfig.js";
import type { QualityGateStateType } from "../state.js";
import type { CoverageResult } from "../types.js";

const COVERAGE_TIMEOUT_MS = 120_000;

// El reporte de --experimental-test-coverage termina con una línea
// resumen real: "# all files | NN.NN | branch% | funcs% | uncovered".
// Este regex extrae el primer número (cobertura de líneas).
const ALL_FILES_LINE = /#\s*all files\s*\|\s*([\d.]+)/;

export function parseCoverageOutput(output: string): number {
  const match = output.match(ALL_FILES_LINE);
  return match ? Number.parseFloat(match[1]) : 0;
}

const baselinePctByTargetPath = new Map<string, number>();

// El baseline se calcula contra el target repo (no process.cwd()).
// Cacheado por targetPath para soportar múltiples targets en la misma sesión.
async function measureBaseline(command: string, targetPath: string): Promise<number> {
  if (baselinePctByTargetPath.has(targetPath)) {
    return baselinePctByTargetPath.get(targetPath)!;
  }
  const { stdout, stderr } = await runCommand(command, { cwd: targetPath, timeoutMs: COVERAGE_TIMEOUT_MS });
  const baselinePct = parseCoverageOutput(stdout + stderr);
  baselinePctByTargetPath.set(targetPath, baselinePct);
  return baselinePct;
}

export async function checkCoverageNode(state: QualityGateStateType): Promise<{ coverageDelta: CoverageResult }> {
  const config = loadQualityGateConfig();
  const { command, maxDropPct } = config.qualityGate.coverage;

  const beforePct = await measureBaseline(command, state.targetPath);
  const { stdout, stderr } = await runCommand(command, { cwd: state.sandboxPath, timeoutMs: COVERAGE_TIMEOUT_MS });
  const afterPct = parseCoverageOutput(stdout + stderr);

  return { coverageDelta: { beforePct, afterPct, thresholdPct: maxDropPct } };
}
