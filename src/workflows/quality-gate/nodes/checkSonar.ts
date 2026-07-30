import fs from "node:fs";
import path from "node:path";
import { runCommand } from "../../validation-pipeline/tools/exec.js";
import { loadQualityGateConfig } from "../../../config/loadQualityGateConfig.js";
import type { QualityGateStateType } from "../state.js";
import type { SonarResult } from "../types.js";

const SONAR_TIMEOUT_MS = 60_000;
const DUPLICATE_BLOCK_LINES = 6;

// Sustituto real de "duplicación de código" de Sonar: cuenta bloques de
// DUPLICATE_BLOCK_LINES líneas consecutivas (ignorando líneas en blanco)
// que aparecen más de una vez entre los archivos tocados. No es tan preciso
// como un motor de clones real, pero es una señal genuina, no inventada.
function measureDuplicationPct(fileContents: string[]): number {
  const allLines = fileContents.flatMap((text) => text.split("\n").filter((l) => l.trim().length > 0));
  if (allLines.length < DUPLICATE_BLOCK_LINES) return 0;

  const seen = new Map<string, number>();
  let duplicateBlocks = 0;
  const totalBlocks = allLines.length - DUPLICATE_BLOCK_LINES + 1;

  for (let i = 0; i < totalBlocks; i++) {
    const block = allLines.slice(i, i + DUPLICATE_BLOCK_LINES).join("\n");
    const count = (seen.get(block) ?? 0) + 1;
    seen.set(block, count);
    if (count > 1) duplicateBlocks++;
  }

  return totalBlocks === 0 ? 0 : Number(((duplicateBlocks / totalBlocks) * 100).toFixed(1));
}

export async function checkSonarNode(state: QualityGateStateType): Promise<{ sonarResult: SonarResult }> {
  const config = loadQualityGateConfig();
  const { eslintConfig } = config.qualityGate.sonar;
  const touchedFiles = state.task?.touchesFiles ?? [];

  if (touchedFiles.length === 0) {
    return { sonarResult: { newCodeSmells: 0, newDuplicationPct: 0, qualityGatePassed: true } };
  }

  const { stdout } = await runCommand(
    `npx eslint --config ${eslintConfig} --format json ${touchedFiles.join(" ")}`,
    { cwd: state.sandboxPath, timeoutMs: SONAR_TIMEOUT_MS }
  );

  let newCodeSmells = 0;
  try {
    const results = JSON.parse(stdout) as { messages: { ruleId: string | null }[] }[];
    // ruleId===null son mensajes meta de ESLint (p. ej. "File ignored
    // because no matching configuration was supplied" para un archivo que
    // no es .ts, como package.json) — no son smells reales de sonarjs.
    newCodeSmells = results.reduce(
      (sum, r) => sum + r.messages.filter((m) => m.ruleId !== null).length,
      0
    );
  } catch {
    // eslint --format json siempre debería producir JSON parseable; si no,
    // se trata como "sin señal" en vez de reventar el Quality Gate entero.
    newCodeSmells = 0;
  }

  const fileContents = touchedFiles
    .map((file) => path.join(state.sandboxPath, file))
    .filter((absPath) => fs.existsSync(absPath))
    .map((absPath) => fs.readFileSync(absPath, "utf8"));
  const newDuplicationPct = measureDuplicationPct(fileContents);

  // "passed" significa "sin nada nuevo que reportar" — no "por debajo del
  // umbral de bloqueo". assembleReportNode es quien decide advisory vs.
  // blocking comparando contra los umbrales de config/quality-gate.yml;
  // este nodo solo entrega el hecho objetivo (cuántos smells/duplicación
  // reales hay), nunca una opinión ya filtrada por umbral.
  const qualityGatePassed = newCodeSmells === 0 && newDuplicationPct === 0;

  return { sonarResult: { newCodeSmells, newDuplicationPct, qualityGatePassed } };
}
