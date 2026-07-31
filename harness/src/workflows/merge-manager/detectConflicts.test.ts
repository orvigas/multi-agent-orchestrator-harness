import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectConflictsNode } from "./nodes/detectConflicts.js";
import type { MergeManagerStateType } from "./state.js";
import type { Patch } from "../implementation/types.js";

function makeTarget(fileName: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merge-manager-test-"));
  fs.writeFileSync(path.join(dir, fileName), contents);
  return dir;
}

function patchFor(fileName: string): Patch {
  return {
    taskId: "detect-conflicts-test",
    rationale: "test",
    hunks: [
      {
        file: fileName,
        contextBefore: ["a"],
        oldLines: ["b"],
        newLines: ["b-changed"],
        contextAfter: ["c"],
      },
    ],
  };
}

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

test("detectConflictsNode: no conflicts when the real target's context still matches the patch", () => {
  const dir = makeTarget("file.ts", "a\nb\nc\n");
  const result = detectConflictsNode(baseState({ targetPath: dir, patch: patchFor("file.ts") }));
  assert.equal(result.conflictReport.hasConflicts, false);
  assert.deepEqual(result.conflictReport.files, []);
});

test("detectConflictsNode: real conflict when the target file changed since the patch was generated", () => {
  const dir = makeTarget("file.ts", "a\nSOMEONE ELSE EDITED THIS\nc\n");
  const result = detectConflictsNode(baseState({ targetPath: dir, patch: patchFor("file.ts") }));
  assert.equal(result.conflictReport.hasConflicts, true);
  assert.deepEqual(result.conflictReport.files, ["file.ts"]);
});

test("detectConflictsNode: an empty patch never conflicts", () => {
  const dir = makeTarget("file.ts", "a\nb\nc\n");
  const emptyPatch: Patch = { taskId: "empty", rationale: "nothing to do", hunks: [] };
  const result = detectConflictsNode(baseState({ targetPath: dir, patch: emptyPatch }));
  assert.equal(result.conflictReport.hasConflicts, false);
});
