import { test } from "node:test";
import assert from "node:assert/strict";
import { routeAfterBudgetCheck, routeAfterImplementation, routeAfterRecovery } from "./nodes/routing.js";
import type { OrchestratorStateType } from "./state.js";

function baseState(overrides: Partial<OrchestratorStateType> = {}): OrchestratorStateType {
  return {
    targetPath: process.cwd(),
    backlog: [],
    currentTicket: { id: "T-1", title: "demo" },
    decisionLog: [],
    retryCount: 0,
    maxRetries: 3,
    strategy: "continue",
    lastImplementationResult: null,
    tokenBudget: { limit: 200_000, used: 0 },
    costBudget: { limitUsd: 5, usedUsd: 0 },
    deadline: null,
    config: null,
    knowledgeEvidence: [],
    plan: null,
    failureCategory: null,
    validationEvidence: [],
    patchAttempts: [],
    failedSandboxPath: null,
    recoveryHistory: [],
    failedTaskId: null,
    targetedFixTask: null,
    implementerFallbackIndex: 0,
    qualityGateIssues: [],
    mergeConflict: null,
    tokenEvents: [],
    ...overrides,
  };
}

test("routeAfterBudgetCheck: continues when budget and ticket are available", () => {
  assert.equal(routeAfterBudgetCheck(baseState()), "continue");
});

test("routeAfterBudgetCheck: stops when there is no current ticket", () => {
  assert.equal(routeAfterBudgetCheck(baseState({ currentTicket: null })), "stop");
});

test("routeAfterBudgetCheck: stops when token budget is exhausted", () => {
  assert.equal(
    routeAfterBudgetCheck(baseState({ tokenBudget: { limit: 100, used: 100 } })),
    "stop"
  );
});

test("routeAfterBudgetCheck: stops when cost budget is exhausted", () => {
  assert.equal(
    routeAfterBudgetCheck(baseState({ costBudget: { limitUsd: 1, usedUsd: 1 } })),
    "stop"
  );
});

test("routeAfterBudgetCheck: stops when deadline has passed", () => {
  assert.equal(
    routeAfterBudgetCheck(baseState({ deadline: new Date(Date.now() - 1000).toISOString() })),
    "stop"
  );
});

test("routeAfterImplementation: reads lastImplementationResult", () => {
  assert.equal(routeAfterImplementation(baseState({ lastImplementationResult: "pass" })), "pass");
  assert.equal(routeAfterImplementation(baseState({ lastImplementationResult: "fail" })), "fail");
  assert.equal(routeAfterImplementation(baseState({ lastImplementationResult: null })), "fail");
});

test("routeAfterRecovery: abort strategy wins outright", () => {
  assert.equal(routeAfterRecovery(baseState({ strategy: "abort" })), "abort");
});

test("routeAfterRecovery: change_model routes to change_model", () => {
  assert.equal(routeAfterRecovery(baseState({ strategy: "change_model" })), "change_model");
});

test("routeAfterRecovery: rollback/change_context route to retry_planning", () => {
  assert.equal(routeAfterRecovery(baseState({ strategy: "rollback" })), "retry_planning");
  assert.equal(routeAfterRecovery(baseState({ strategy: "change_context" })), "retry_planning");
});

test("routeAfterRecovery: aborts once retryCount reaches maxRetries", () => {
  assert.equal(
    routeAfterRecovery(baseState({ strategy: "continue", retryCount: 3, maxRetries: 3 })),
    "abort"
  );
});

test("routeAfterRecovery: otherwise retries implementation", () => {
  assert.equal(
    routeAfterRecovery(baseState({ strategy: "continue", retryCount: 1, maxRetries: 3 })),
    "retry_implementation"
  );
});
