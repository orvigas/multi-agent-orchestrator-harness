import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlanNode } from "./nodes/validatePlan.js";
import type { PlannerStateType } from "./state.js";
import type { Plan } from "./types.js";

function baseState(overrides: Partial<PlannerStateType> = {}): PlannerStateType {
  return { targetPath: process.cwd(),
    ticket: { id: "T-1", title: "demo" },
    evidence: [],
    discovery: { problems: ["demo"], dependencies: ["src/foo.ts"], risks: [] },
    plan: { tasks: [{ id: "task-1", description: "actualizar foo", touchesFiles: ["src/foo.ts"] }], order: ["task-1"], dependencies: {} },
    planRevisions: [],
    validationIssues: [],
    validationVerdict: "invalid",
    planningIteration: 1,
    maxPlanningIterations: 4,
    strategy: "proceed",
    discoveryGapThreshold: 0.5,
    ...overrides,
  };
}

test("validatePlanNode: a clean plan with no risks is valid", () => {
  const result = validatePlanNode(baseState());
  assert.equal(result.validationVerdict, "valid");
  assert.deepEqual(result.validationIssues, []);
  assert.equal(result.strategy, "proceed");
});

test("validatePlanNode: touching a real forbidden-zones path is flagged plan_error", () => {
  const plan: Plan = {
    tasks: [{ id: "task-1", description: "tocar secretos", touchesFiles: ["secrets/foo.ts"] }],
    order: ["task-1"],
    dependencies: {},
  };
  const result = validatePlanNode(baseState({ plan }));
  assert.equal(result.validationVerdict, "invalid");
  assert.ok(result.validationIssues.some((i) => i.rule === "forbidden-zones" && i.rootCause === "plan_error"));
});

test("validatePlanNode: an unmitigated high-severity risk is flagged plan_error", () => {
  const state = baseState({
    discovery: {
      problems: ["demo"],
      dependencies: ["src/foo.ts"],
      risks: [{ description: "Cambio destructivo elimina configuracion importante", severity: "high" }],
    },
  });
  const result = validatePlanNode(state);
  assert.equal(result.validationVerdict, "invalid");
  assert.ok(result.validationIssues.some((i) => i.rule === "risk-mitigation" && i.rootCause === "plan_error"));
});

test("validatePlanNode: a task description that shares terms with the risk mitigates it", () => {
  const state = baseState({
    discovery: {
      problems: ["demo"],
      dependencies: ["src/foo.ts"],
      risks: [{ description: "Cambio destructivo elimina configuracion importante", severity: "high" }],
    },
    plan: {
      tasks: [
        { id: "mitigate-1", description: "Mitigar riesgo: cambio destructivo elimina configuracion", touchesFiles: [] },
        { id: "task-1", description: "actualizar foo", touchesFiles: ["src/foo.ts"] },
      ],
      order: ["mitigate-1", "task-1"],
      dependencies: { "task-1": ["mitigate-1"] },
    },
  });
  const result = validatePlanNode(state);
  assert.equal(result.validationVerdict, "valid");
});

test("validatePlanNode: no dependencies and no risks is flagged discovery_gap", () => {
  const result = validatePlanNode(
    baseState({ discovery: { problems: ["demo"], dependencies: [], risks: [] } })
  );
  assert.equal(result.validationVerdict, "invalid");
  assert.ok(
    result.validationIssues.some((i) => i.rule === "discovery-completeness" && i.rootCause === "discovery_gap")
  );
});
