import { knowledgeEngineWorkflow } from "../knowledge-engine/graph.js";
import { plannerWorkflow } from "./graph.js";
import type { Ticket } from "../../orchestrator/types.js";

const ticket: Ticket = {
  id: "PLAN-DEMO-1",
  title: "Eliminar bootstrapNode y su lógica de carga de config",
  description: "Quitar `bootstrapNode` del grafo del Orchestrator junto con todo lo que lo referencia.",
  status: "pending",
};

console.log("=== Paso 1: Knowledge Engine (Capa 2) reúne evidencia real ===");
const kbResult = await knowledgeEngineWorkflow.invoke({ ticket });
console.log(`Evidencia: ${kbResult.confirmedEvidence.length} items, sufficiency=${kbResult.sufficiency}`);

console.log("\n=== Paso 2: Planner (Capa 3) — Discovery -> Planning -> Validation ===");
const result = await plannerWorkflow.invoke({
  ticket,
  evidence: kbResult.evidencePackage ?? kbResult.confirmedEvidence,
});

console.log("\n--- Discovery ---");
console.log(`Problems: ${result.discovery?.problems.join("; ")}`);
console.log(`Dependencies: ${result.discovery?.dependencies.join(", ")}`);
for (const risk of result.discovery?.risks ?? []) {
  console.log(`Risk [${risk.severity}]: ${risk.description}`);
}

console.log(`\n--- Revisiones de plan (${result.planRevisions.length}) ---`);
for (const revision of result.planRevisions) {
  const rejected = revision.rejectedBy?.length ? ` (corrige ${revision.rejectedBy.length} issue(s) previo(s))` : "";
  console.log(`Iteración ${revision.iteration}${rejected}:`);
  for (const task of revision.plan.tasks) {
    console.log(`  - ${task.id}: ${task.description} [${task.touchesFiles.join(", ") || "sin archivos"}]`);
  }
}

console.log(`\n--- Resultado final ---`);
console.log(`Iteraciones: ${result.planningIteration}/${result.maxPlanningIterations}`);
console.log(`Veredicto: ${result.validationVerdict} (strategy=${result.strategy})`);
if (result.validationIssues.length > 0) {
  console.log("Issues pendientes:");
  for (const issue of result.validationIssues) {
    console.log(`  - [${issue.rootCause}] ${issue.rule}: ${issue.detail}`);
  }
}
