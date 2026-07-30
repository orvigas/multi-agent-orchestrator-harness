import { test } from "node:test";
import assert from "node:assert/strict";
import { routeConflicts } from "./routing.js";
import type { MergeManagerStateType } from "./state.js";

function baseState(overrides: Partial<MergeManagerStateType>): MergeManagerStateType {
  return {
    task: null,
    patch: null,
    targetPath: "",
    dryRun: true,
    conflictReport: null,
    promoted: false,
    escalationReason: null,
    ...overrides,
  };
}

test("routeConflicts: no_conflicts when conflictReport says hasConflicts:false", () => {
  const state = baseState({ conflictReport: { hasConflicts: false, files: [] } });
  assert.equal(routeConflicts(state), "no_conflicts");
});

test("routeConflicts: conflict when conflictReport says hasConflicts:true", () => {
  const state = baseState({ conflictReport: { hasConflicts: true, files: ["a.ts"] } });
  assert.equal(routeConflicts(state), "conflict");
});

test("routeConflicts: no_conflicts when conflictReport is null (never ran)", () => {
  const state = baseState({ conflictReport: null });
  assert.equal(routeConflicts(state), "no_conflicts");
});
