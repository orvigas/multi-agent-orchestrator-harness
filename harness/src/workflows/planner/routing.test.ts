import { test } from "node:test";
import assert from "node:assert/strict";
import { routeAfterValidation } from "./nodes/routing.js";
import type { PlannerStateType } from "./state.js";

function baseState(overrides: Partial<PlannerStateType> = {}): PlannerStateType {
  return { targetPath: process.cwd(),
    config: null,
    ticket: { id: "T-1", title: "demo" },
    evidence: [],
    discovery: null,
    plan: null,
    planRevisions: [],
    validationIssues: [],
    validationVerdict: "invalid",
    planningIteration: 0,
    maxPlanningIterations: 4,
    strategy: "proceed",
    discoveryGapThreshold: 0.5,
    ...overrides,
  };
}

test("routeAfterValidation: valid verdict always proceeds, regardless of iteration", () => {
  assert.equal(
    routeAfterValidation(baseState({ validationVerdict: "valid", planningIteration: 0 })),
    "proceed"
  );
});

test("routeAfterValidation: escalates once maxPlanningIterations is reached", () => {
  assert.equal(
    routeAfterValidation(
      baseState({ validationVerdict: "invalid", planningIteration: 4, maxPlanningIterations: 4 })
    ),
    "escalate"
  );
});

test("routeAfterValidation: revisits discovery when most issues are discovery_gap", () => {
  assert.equal(
    routeAfterValidation(
      baseState({
        validationVerdict: "invalid",
        planningIteration: 1,
        validationIssues: [
          { rule: "discovery-completeness", detail: "x", rootCause: "discovery_gap" },
          { rule: "discovery-completeness", detail: "y", rootCause: "discovery_gap" },
        ],
      })
    ),
    "revisit_discovery"
  );
});

test("routeAfterValidation: revises the plan when issues are mostly plan_error", () => {
  assert.equal(
    routeAfterValidation(
      baseState({
        validationVerdict: "invalid",
        planningIteration: 1,
        validationIssues: [
          { rule: "risk-mitigation", detail: "x", rootCause: "plan_error" },
          { rule: "forbidden-zones", detail: "y", rootCause: "plan_error" },
        ],
      })
    ),
    "revise_plan"
  );
});
