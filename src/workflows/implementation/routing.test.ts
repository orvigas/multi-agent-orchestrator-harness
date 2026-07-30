import { test } from "node:test";
import assert from "node:assert/strict";
import { routeAfterQuickCheck } from "./nodes/routing.js";
import { selectPatternNode } from "./nodes/selectPattern.js";
import type { ImplementationStateType } from "./state.js";

function baseState(overrides: Partial<ImplementationStateType> = {}): ImplementationStateType {
  return { targetPath: process.cwd(),
    task: { id: "task-1", description: "demo", touchesFiles: [] },
    taskContext: [],
    selectedPattern: "retry",
    patch: null,
    patchAttempts: [],
    quickCheck: null,
    sandboxPath: null,
    iteration: 0,
    maxIterations: 3,
    outcome: "ready_for_validation",
    ...overrides,
  };
}

test("routeAfterQuickCheck: ready when quickCheck passed", () => {
  assert.equal(
    routeAfterQuickCheck(baseState({ quickCheck: { passed: true, signal: "compile", detail: "ok" } })),
    "ready"
  );
});

test("routeAfterQuickCheck: escalates immediately on a 'refused' signal, regardless of iteration budget left", () => {
  assert.equal(
    routeAfterQuickCheck(
      baseState({ quickCheck: { passed: false, signal: "refused", detail: "zona prohibida" }, iteration: 0, maxIterations: 3 })
    ),
    "escalate"
  );
});

test("routeAfterQuickCheck: escalates once maxIterations is reached", () => {
  assert.equal(
    routeAfterQuickCheck(
      baseState({
        quickCheck: { passed: false, signal: "compile", detail: "fail" },
        iteration: 3,
        maxIterations: 3,
      })
    ),
    "escalate"
  );
});

test("routeAfterQuickCheck: retries otherwise", () => {
  assert.equal(
    routeAfterQuickCheck(
      baseState({ quickCheck: { passed: false, signal: "compile", detail: "fail" }, iteration: 1, maxIterations: 3 })
    ),
    "retry"
  );
});

test("selectPatternNode: routes to test_driven when the task has an existing test", () => {
  const result = selectPatternNode(baseState({ task: { id: "t", description: "d", touchesFiles: [], hasExistingTest: true } }));
  assert.equal(result.selectedPattern, "test_driven");
});

test("selectPatternNode: routes to compiler_driven for a typed-language task", () => {
  const result = selectPatternNode(baseState({ task: { id: "t", description: "d", touchesFiles: [], language: "typed" } }));
  assert.equal(result.selectedPattern, "compiler_driven");
});

test("selectPatternNode: falls back to retry otherwise", () => {
  const result = selectPatternNode(baseState({ task: { id: "t", description: "d", touchesFiles: [] } }));
  assert.equal(result.selectedPattern, "retry");
});
