import type { ValidationStateType } from "../state.js";

export function routeAfterCompile(state: ValidationStateType): "continue" | "fail_fast" {
  const compileResult = state.results.find((r) => r.stage === "compile");
  return compileResult?.passed ? "continue" : "fail_fast";
}

// Nota: el how-to (sección 3) escribe esto como
// addConditionalEdges("tests", ..., {continue: "lint", fail_fast: "assemble_verdict"})
// más addEdge("tests","static_analysis") y addEdge("tests","security") como
// edges incondicionales aparte. Eso es un bug real en su propio ejemplo: esos
// dos edges incondicionales correrían static_analysis/security AUNQUE tests
// falle, contradiciendo el fail-fast que la sección 0/1 exige. La forma
// correcta de expresar un fan-out condicional en LangGraph es que la función
// de ruteo devuelva un ARRAY de destinos — así los tres (lint, static_analysis,
// security) quedan igualmente condicionados a que tests haya pasado.
export function routeAfterTests(state: ValidationStateType): string | string[] {
  const testResult = state.results.find((r) => r.stage === "tests");
  return testResult?.passed ? ["lint", "static_analysis", "security"] : "assemble_verdict";
}

export function routeAfterParallelChecks(state: ValidationStateType): "continue" | "fail_fast" {
  const parallel = state.results.filter((r) => ["lint", "static_analysis", "security"].includes(r.stage));
  const allPassed = parallel.every((r) => r.passed);
  return allPassed ? "continue" : "fail_fast";
}
