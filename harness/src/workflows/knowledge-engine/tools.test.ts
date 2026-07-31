import { test } from "node:test";
import assert from "node:assert/strict";
import { astQuery } from "./tools/astQuery.js";
import { grepSearch } from "./tools/grepSearch.js";
import { vectorSearch } from "./tools/vectorSearch.js";

// Estos tests corren contra el propio código de este repo (self-indexing),
// no contra fixtures sintéticos: prueban que las tools son reales, no stubs.

test("astQuery: definition:bootstrapNode encuentra su declaración", () => {
  const results = astQuery("definition:bootstrapNode");
  assert.ok(results.length >= 1, "se esperaba al menos un resultado");
  assert.ok(results.some((r) => r.id.includes("orchestrator/nodes/bootstrap.ts")));
  assert.equal(results[0].source, "ast");
});

test("astQuery: usages:bootstrapNode encuentra dónde se usa (graph.ts)", () => {
  const results = astQuery("usages:bootstrapNode");
  assert.ok(results.length >= 1, "se esperaba al menos una referencia");
  assert.ok(results.some((r) => r.id.includes("orchestrator/graph.ts")));
});

test("astQuery: query sin resultados devuelve []", () => {
  assert.deepEqual(astQuery("definition:NoExisteEsteSimbolo"), []);
});

test("grepSearch: encuentra routeAfterBudgetCheck en el código real", () => {
  const results = grepSearch("routeAfterBudgetCheck");
  assert.ok(results.length >= 1);
  assert.ok(results.some((r) => r.id.includes("orchestrator/nodes/routing.ts")));
  assert.equal(results[0].source, "grep");
});

test("grepSearch: query sin coincidencias devuelve []", () => {
  assert.deepEqual(grepSearch("xyzNoExisteEnNingunArchivo"), []);
});

test("vectorSearch: encuentra contenido sobre presupuesto con una consulta en lenguaje natural", () => {
  const results = vectorSearch("presupuesto de tokens y costo del orchestrator");
  assert.ok(results.length >= 1, "se esperaba al menos un chunk relevante");
  assert.ok(
    results.some((r) => r.id.includes("budgetGuard.ts") || r.id.includes("governance/budgets.md"))
  );
  assert.equal(results[0].source, "vector");
});
