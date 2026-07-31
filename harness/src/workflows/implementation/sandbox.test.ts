import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSandbox, applyPatch, cleanupSandbox } from "./tools/sandbox.js";
import type { Patch } from "./types.js";

const TARGET_FILE = "src/orchestrator/types.ts";

test("sandbox: applying a patch changes the sandboxed copy but never the real file", () => {
  const realPath = path.resolve(process.cwd(), TARGET_FILE);
  const realContentBefore = fs.readFileSync(realPath, "utf8");
  const lines = realContentBefore.split("\n");
  const lastLine = lines[lines.length - 1];

  const patch: Patch = {
    taskId: "sandbox-test",
    hunks: [
      {
        file: TARGET_FILE,
        contextBefore: lines.slice(Math.max(0, lines.length - 3), lines.length - 1),
        oldLines: [lastLine],
        newLines: [lastLine, "// sandbox-test marker"],
        contextAfter: [],
      },
    ],
    rationale: "test",
  };

  const sandbox = createSandbox("sandbox-test");
  try {
    const result = applyPatch(sandbox.path, patch);
    assert.equal(result.applied, true);

    const sandboxedContent = fs.readFileSync(path.join(sandbox.path, TARGET_FILE), "utf8");
    assert.ok(sandboxedContent.includes("// sandbox-test marker"));

    const realContentAfter = fs.readFileSync(realPath, "utf8");
    assert.equal(realContentAfter, realContentBefore, "the real project file must never change");
  } finally {
    cleanupSandbox(sandbox.path);
  }

  assert.equal(fs.existsSync(sandbox.path), false);
});

test("sandbox: applying a patch whose context can't be found reports failure", () => {
  const patch: Patch = {
    taskId: "sandbox-test-2",
    hunks: [
      {
        file: TARGET_FILE,
        contextBefore: ["this line does not exist in the file"],
        oldLines: ["neither does this one"],
        newLines: ["replacement"],
        contextAfter: [],
      },
    ],
    rationale: "test",
  };

  const sandbox = createSandbox("sandbox-test-2");
  try {
    const result = applyPatch(sandbox.path, patch);
    assert.equal(result.applied, false);
  } finally {
    cleanupSandbox(sandbox.path);
  }
});

// dryRun (Capa 8, Merge Manager): mismo chequeo de contexto, pero contra un
// directorio descartable en vez de un sandbox real — nunca escribe.
function makeTempTarget(fileName: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-dryrun-test-"));
  fs.writeFileSync(path.join(dir, fileName), contents);
  return dir;
}

function contextPatch(fileName: string): Patch {
  return {
    taskId: "dryrun-test",
    rationale: "test",
    hunks: [
      { file: fileName, contextBefore: ["a"], oldLines: ["b"], newLines: ["b-changed"], contextAfter: ["c"] },
    ],
  };
}

test("applyPatch: dryRun reports no conflicts and never writes when context matches", () => {
  const dir = makeTempTarget("target.txt", "a\nb\nc\n");
  const before = fs.readFileSync(path.join(dir, "target.txt"), "utf8");

  const result = applyPatch(dir, contextPatch("target.txt"), { dryRun: true });

  assert.equal(result.applied, true);
  assert.deepEqual(result.conflictingFiles, []);
  assert.equal(fs.readFileSync(path.join(dir, "target.txt"), "utf8"), before);
});

test("applyPatch: dryRun detects a real conflict when the target changed since the patch was generated", () => {
  const dir = makeTempTarget("target.txt", "a\nSOMEONE ELSE CHANGED THIS\nc\n");
  const before = fs.readFileSync(path.join(dir, "target.txt"), "utf8");

  const result = applyPatch(dir, contextPatch("target.txt"), { dryRun: true });

  assert.equal(result.applied, false);
  assert.deepEqual(result.conflictingFiles, ["target.txt"]);
  assert.equal(fs.readFileSync(path.join(dir, "target.txt"), "utf8"), before, "dryRun must never mutate");
});

test("applyPatch: dryRun collects every conflicting file instead of stopping at the first", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-dryrun-test-"));
  fs.writeFileSync(path.join(dir, "a.txt"), "a\nCHANGED-A\nc\n");
  fs.writeFileSync(path.join(dir, "b.txt"), "a\nCHANGED-B\nc\n");

  const patch: Patch = {
    taskId: "multi-file",
    rationale: "test",
    hunks: [contextPatch("a.txt").hunks[0], contextPatch("b.txt").hunks[0]],
  };

  const result = applyPatch(dir, patch, { dryRun: true });
  assert.equal(result.applied, false);
  assert.deepEqual(result.conflictingFiles, ["a.txt", "b.txt"]);
});
