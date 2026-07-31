import fs from "node:fs";
import path from "node:path";
import { createSandbox, applyPatch, cleanupSandbox } from "../implementation/tools/sandbox.js";
import { qualityGateWorkflow } from "./graph.js";
import type { Patch } from "../implementation/types.js";
import type { PlanTask } from "../planner/types.js";

const TARGET_FILE = "src/orchestrator/nodes/budgetGuard.ts";

async function runScenario(label: string, sandboxLabel: string, task: PlanTask, patch: Patch) {
  console.log(`\n=== ${label} ===`);

  const sandbox = createSandbox(sandboxLabel);
  const applyResult = applyPatch(sandbox.path, patch);
  console.log(`Sandbox: ${sandbox.path}`);
  console.log(`Apply: ${applyResult.applied ? "ok" : `FALLÓ (${applyResult.detail})`}`);

  // Se asume que Validation Pipeline (Capa 5) ya dio "pass" para llegar
  // hasta acá — este demo no la vuelve a correr, exactamente como el how-to
  // exige ("reutiliza esa evidencia, no la vuelve a generar").
  const result = await qualityGateWorkflow.invoke({ sandboxPath: sandbox.path, patch, task, validationEvidence: [] });

  console.log(`Coverage: ${result.coverageDelta?.beforePct}% -> ${result.coverageDelta?.afterPct}%`);
  console.log(
    `Sonar: ${result.sonarResult?.newCodeSmells} smells nuevos, ${result.sonarResult?.newDuplicationPct}% duplicación`
  );
  console.log(`Architecture: compliant=${result.architectureReview?.compliant}`);
  console.log(`Documentation: compliant=${result.documentationReview?.compliant}`);
  console.log(`Veredicto: ${result.verdict}`);
  for (const issue of result.issues) {
    console.log(`  - [${issue.severity}] ${issue.dimension}: ${issue.evidence} -> ${issue.recommendation}`);
  }

  if (result.verdict === "blocking") console.log("(sandbox conservado para inspección: verdict=blocking)");
  else cleanupSandbox(sandbox.path);
}

// Escenario 1: patch normal (agrega un comentario TODO trazable, igual que
// el Implementer real de la Capa 4) -> Sonar detecta el TODO como smell
// real (severidad advisory, bajo el umbral de bloqueo).
{
  const realPath = path.resolve(process.cwd(), TARGET_FILE);
  const lines = fs.readFileSync(realPath, "utf8").split("\n");
  const lastLine = lines[lines.length - 1];
  const patch: Patch = {
    taskId: "qg-demo-1",
    hunks: [
      {
        file: TARGET_FILE,
        contextBefore: lines.slice(Math.max(0, lines.length - 3), lines.length - 1),
        oldLines: [lastLine],
        newLines: [lastLine, "// TODO(task qg-demo-1): revisar según el plan generado."],
        contextAfter: [],
      },
    ],
    rationale: "comentario TODO trazable, como el Implementer real",
  };
  await runScenario(
    "Escenario 1: patch con TODO trazable (Sonar real detecta el smell)",
    "qg-demo-1",
    { id: "qg-demo-1", description: "Actualizar budgetGuard", touchesFiles: [TARGET_FILE] },
    patch
  );
}

// Escenario 2: patch toca superficie pública (package.json) sin tocar
// ningún doc -> Documentation review real marca no-compliant (advisory,
// nunca bloquea sola).
{
  const realPath = path.resolve(process.cwd(), "package.json");
  const lines = fs.readFileSync(realPath, "utf8").split("\n");
  const lastLine = lines[lines.length - 1];
  const patch: Patch = {
    taskId: "qg-demo-2",
    hunks: [
      {
        file: "package.json",
        contextBefore: lines.slice(Math.max(0, lines.length - 2), lines.length - 1),
        oldLines: [lastLine],
        newLines: [lastLine],
        contextAfter: [],
      },
    ],
    rationale: "toca package.json sin actualizar documentación, a propósito",
  };
  await runScenario(
    "Escenario 2: toca package.json sin tocar docs (Documentation review real)",
    "qg-demo-2",
    { id: "qg-demo-2", description: "Agregar un script npm", touchesFiles: ["package.json"] },
    patch
  );
}
