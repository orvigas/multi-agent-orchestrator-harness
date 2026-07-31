import { implementationWorkflow } from "./graph.js";
import type { PlanTask } from "../planner/types.js";

async function runTask(label: string, task: PlanTask) {
  console.log(`\n=== ${label} ===`);
  const result = await implementationWorkflow.invoke({ task });

  console.log(`Pattern seleccionado: ${result.selectedPattern}`);
  console.log(`Sandbox: ${result.sandboxPath ?? "(sin sandbox, patch vacío)"}`);
  console.log(`Rationale: ${result.patch?.rationale}`);
  for (const hunk of result.patch?.hunks ?? []) {
    console.log(`  hunk -> ${hunk.file} (+${hunk.newLines.length - hunk.oldLines.length} línea(s))`);
  }
  console.log(
    `Quick-check: passed=${result.quickCheck?.passed} signal=${result.quickCheck?.signal} :: ${result.quickCheck?.detail}`
  );
  console.log(`Iteraciones: ${result.iteration}/${result.maxIterations}, outcome=${result.outcome}`);
}

await runTask("Task 1: archivo real (compiler_driven)", {
  id: "impl-demo-1",
  description: "Agregar un comentario trazable en budgetGuard",
  touchesFiles: ["src/orchestrator/nodes/budgetGuard.ts"],
  language: "typed",
});

await runTask("Task 2: zona prohibida (patch vacío por gobernanza)", {
  id: "impl-demo-2",
  description: "Tocar un archivo de secrets (no debería generarse patch)",
  touchesFiles: ["secrets/config.ts"],
  language: "typed",
});
