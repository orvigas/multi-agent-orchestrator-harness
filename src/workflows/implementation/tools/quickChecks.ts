import { spawnSync } from "node:child_process";
import { truncate } from "../../../config/truncate.js";
import type { QuickCheckResult } from "../types.js";

const MAX_DETAIL_CHARS = 2000;

// Señal barata real: compila SOLO el sandbox (nunca la rama de trabajo),
// no la Validation Pipeline completa (Capa 5).
export function runCompileCheck(sandboxPath: string, files: string[]): QuickCheckResult {
  if (files.length === 0) {
    return { passed: true, signal: "compile", detail: "sin archivos que compilar (patch vacío)" };
  }

  const result = spawnSync("npx", ["tsc", "--noEmit"], { cwd: sandboxPath, encoding: "utf8" });
  const passed = result.status === 0;
  return {
    passed,
    signal: "compile",
    detail: passed
      ? "tsc --noEmit sin errores"
      : truncate(`${result.stdout ?? ""}${result.stderr ?? ""}`.trim(), MAX_DETAIL_CHARS),
  };
}

// Señal barata real: corre SOLO el test relacionado con la task, no la
// suite completa.
export function runSingleTest(sandboxPath: string, testFilePath: string): QuickCheckResult {
  const result = spawnSync("npx", ["tsx", "--test", testFilePath], { cwd: sandboxPath, encoding: "utf8" });
  const passed = result.status === 0;
  return {
    passed,
    signal: "test",
    detail: passed
      ? `test relacionado (${testFilePath}) en verde`
      : truncate(`${result.stdout ?? ""}${result.stderr ?? ""}`.trim(), MAX_DETAIL_CHARS),
  };
}
