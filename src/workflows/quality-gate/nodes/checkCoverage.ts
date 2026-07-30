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

let baselinePct: number | null = null;

// El baseline se calcula UNA vez contra el repo real sin parchear (cacheado
// a nivel de módulo, mismo patrón que el resto de los caches del harness) —
// no tiene sentido recalcularlo por cada task, ya que ninguna task toca el
// repo real, solo su propio sandbox.
async function measureBaseline(command: string): Promise<number> {
  if (baselinePct !== null) return baselinePct;
  const { stdout, stderr } = await runCommand(command, { cwd: process.cwd(), timeoutMs: COVERAGE_TIMEOUT_MS });
  baselinePct = parseCoverageOutput(stdout + stderr);
  return baselinePct;
}

export async function checkCoverageNode(state: QualityGateStateType): Promise<{ coverageDelta: CoverageResult }> {
  const config = loadQualityGateConfig();
  const { command, maxDropPct } = config.qualityGate.coverage;

  const beforePct = await measureBaseline(command);
  const { stdout, stderr } = await runCommand(command, { cwd: state.sandboxPath, timeoutMs: COVERAGE_TIMEOUT_MS });
  const afterPct = parseCoverageOutput(stdout + stderr);

  return { coverageDelta: { beforePct, afterPct, thresholdPct: maxDropPct } };
}
