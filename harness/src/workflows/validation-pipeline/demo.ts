import fs from "node:fs";
import path from "node:path";
import { createSandbox, applyPatch, cleanupSandbox } from "../implementation/tools/sandbox.js";
import { validationPipelineWorkflow } from "./graph.js";
import type { Patch } from "../implementation/types.js";
import type { PlanTask } from "../planner/types.js";

const TARGET_FILE = "src/orchestrator/nodes/budgetGuard.ts";

async function runScenario(label: string, sandboxLabel: string, buildPatch: (lines: string[]) => Patch) {
  console.log(`\n=== ${label} ===`);

  const realPath = path.resolve(process.cwd(), TARGET_FILE);
  const lines = fs.readFileSync(realPath, "utf8").split("\n");
  const patch = buildPatch(lines);

  const sandbox = createSandbox(sandboxLabel);
  const applyResult = applyPatch(sandbox.path, patch);
  console.log(`Sandbox: ${sandbox.path}`);
  console.log(`Apply: ${applyResult.applied ? "ok" : `FALLÓ (${applyResult.detail})`}`);

  const task: PlanTask = { id: sandboxLabel, description: label, touchesFiles: [TARGET_FILE] };
  const result = await validationPipelineWorkflow.invoke({ sandboxPath: sandbox.path, patch, task });

  for (const stageResult of result.results) {
    console.log(
      `  [${stageResult.stage}] passed=${stageResult.passed} (${stageResult.durationMs}ms, exit=${stageResult.exitCode})`
    );
  }
  console.log(`Veredicto: ${result.verdict}${result.failureCategory ? ` (failureCategory=${result.failureCategory})` : ""}`);

  const ranStages = result.results.map((r) => r.stage);
  console.log(`Etapas ejecutadas: ${ranStages.join(", ")}`);

  if (result.verdict === "pass") cleanupSandbox(sandbox.path);
  else console.log("(sandbox conservado para inspección: verdict=fail)");
}

// Escenario 1: patch limpio (agrega un comentario, compila y testea bien).
// Nota: aun así puede fallar `security` si `npm audit --audit-level=high`
// encuentra vulnerabilidades reales en dependencias transitivas de este
// proyecto — eso es exactamente el punto de la Capa 5 (sección 4 del
// how-to): un patch que compila y pasa tests puede seguir fallando lint,
// seguridad o performance, y eso lo decide esta pipeline, no el quick-check.
await runScenario("Escenario 1: patch limpio (compile/tests reales)", "val-demo-clean", (lines) => {
  const lastLine = lines[lines.length - 1];
  return {
    taskId: "val-demo-clean",
    hunks: [
      {
        file: TARGET_FILE,
        contextBefore: lines.slice(Math.max(0, lines.length - 3), lines.length - 1),
        oldLines: [lastLine],
        newLines: [lastLine, "// validation-pipeline demo marker"],
        contextAfter: [],
      },
    ],
    rationale: "comentario trazable, no altera comportamiento",
  };
});

// Escenario 2: patch roto (introduce un error de sintaxis real) -> fail-fast
// en compile; tests/lint/static_analysis/security/performance NUNCA corren.
await runScenario("Escenario 2: patch roto (fail-fast en compile)", "val-demo-broken", (lines) => {
  const lastLine = lines[lines.length - 1];
  return {
    taskId: "val-demo-broken",
    hunks: [
      {
        file: TARGET_FILE,
        contextBefore: lines.slice(Math.max(0, lines.length - 3), lines.length - 1),
        oldLines: [lastLine],
        newLines: [lastLine, "export const broken: = ;"],
        contextAfter: [],
      },
    ],
    rationale: "introduce un error de sintaxis real a propósito, para demostrar fail-fast",
  };
});
