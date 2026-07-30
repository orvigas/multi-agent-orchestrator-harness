import { knowledgeEngineWorkflow } from "./graph.js";
import type { Ticket } from "../../orchestrator/types.js";

const ticket: Ticket = {
  id: "KB-DEMO-1",
  title: "¿Qué implementa OrchestratorState y quién llama a bootstrapNode?",
  description:
    "Antes de tocar el grafo del Orchestrator, reunir evidencia sobre `OrchestratorState`, " +
    "quién invoca `bootstrapNode` y cómo se usa `routeAfterBudgetCheck` para decidir si continuar.",
  status: "pending",
};

const result = await knowledgeEngineWorkflow.invoke({ ticket });

console.log("=== Queries intentadas (explore -> narrow) ===");
for (const [i, query] of result.triedQueries.entries()) {
  console.log(`${i + 1}. ${query}`);
}

console.log(`\n=== Evidencia confirmada (${result.confirmedEvidence.length} items) ===`);
for (const item of result.confirmedEvidence) {
  console.log(`- [${item.source}] ${item.id} :: ${item.relevanceNote}`);
}

if (result.discardedEvidence.length > 0) {
  console.log(`\n=== Evidencia descartada (${result.discardedEvidence.length} items) ===`);
  for (const item of result.discardedEvidence) {
    console.log(`- [${item.source}] ${item.relevanceNote}`);
  }
}

console.log(`\n=== Resultado ===`);
console.log(`Iteraciones: ${result.iteration}/${result.maxIterations}`);
console.log(`Sufficiency: ${result.sufficiency}`);
console.log(`Evidence package final: ${result.evidencePackage?.length ?? 0} items`);
