import { spawn } from "node:child_process";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

// Real: cada etapa de la pipeline corre esto contra un binario/tool de
// verdad, nunca un modelo. Un timeout cuenta como fail (gobernanza), no
// como corrida indefinida.
//
// Asíncrono (spawn, no spawnSync): las tres etapas en paralelo (lint,
// static_analysis, security) comparten un solo hilo de Node — con spawnSync
// cada llamada bloquea ese hilo hasta que el subproceso termina, así que el
// fan-out del grafo terminaba ejecutándose secuencial en tiempo real pese a
// la topología paralela. spawn cede el control mientras el subproceso real
// corre, permitiendo que LangGraph de verdad las solape.
export function runCommand(cmd: string, opts: { cwd: string; timeoutMs: number }): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd: opts.cwd, shell: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, opts.timeoutMs);

    child.stdout?.on("data", (chunk) => (stdout += chunk));
    child.stderr?.on("data", (chunk) => (stderr += chunk));

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

export { truncate } from "../../../config/truncate.js";
