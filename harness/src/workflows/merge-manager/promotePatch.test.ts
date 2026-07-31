import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promotePatchNode } from "./nodes/promotePatch.js";
import type { MergeManagerStateType } from "./state.js";
import type { Patch } from "../implementation/types.js";

function makeTarget(fileName: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merge-manager-test-"));
  fs.writeFileSync(path.join(dir, fileName), contents);
  return dir;
}

function patchFor(fileName: string): Patch {
  return {
    taskId: "promote-patch-test",
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

test("promotePatchNode: dryRun reports promoted but never writes to the real target", () => {
  const dir = makeTarget("file.ts", "a\nb\nc\n");
  const result = promotePatchNode(baseState({ targetPath: dir, patch: patchFor("file.ts"), dryRun: true }));

  assert.equal(result.promoted, true);
  const untouched = fs.readFileSync(path.join(dir, "file.ts"), "utf8");
  assert.equal(untouched, "a\nb\nc\n");
});

test("promotePatchNode: dryRun:false actually writes the patch to the real target", () => {
  const dir = makeTarget("file.ts", "a\nb\nc\n");
  const result = promotePatchNode(baseState({ targetPath: dir, patch: patchFor("file.ts"), dryRun: false }));

  assert.equal(result.promoted, true);
  const written = fs.readFileSync(path.join(dir, "file.ts"), "utf8");
  assert.ok(written.includes("b-changed"));
});

test("promotePatchNode: an empty patch is trivially promoted without touching anything", () => {
  const dir = makeTarget("file.ts", "a\nb\nc\n");
  const emptyPatch: Patch = { taskId: "empty", rationale: "nothing to do", hunks: [] };
  const result = promotePatchNode(baseState({ targetPath: dir, patch: emptyPatch, dryRun: false }));

  assert.equal(result.promoted, true);
  const untouched = fs.readFileSync(path.join(dir, "file.ts"), "utf8");
  assert.equal(untouched, "a\nb\nc\n");
});
