import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createSandbox, cleanupSandbox } from "./tools/sandbox.js";
import { runCompileCheck } from "./tools/quickChecks.js";

test("runCompileCheck: passes on a clean sandbox copy of this project", () => {
  const sandbox = createSandbox("quickcheck-clean");
  try {
    const result = runCompileCheck(sandbox.path, ["src/orchestrator/types.ts"]);
    assert.equal(result.passed, true, result.detail);
  } finally {
    cleanupSandbox(sandbox.path);
  }
});

test("runCompileCheck: fails when the sandboxed copy has a real syntax error", () => {
  const sandbox = createSandbox("quickcheck-broken");
  try {
    const filePath = path.join(sandbox.path, "src/orchestrator/types.ts");
    fs.appendFileSync(filePath, "\nexport const broken: = ;\n");

    const result = runCompileCheck(sandbox.path, ["src/orchestrator/types.ts"]);
    assert.equal(result.passed, false);
    assert.ok(result.detail.length > 0);
  } finally {
    cleanupSandbox(sandbox.path);
  }
});

test("runCompileCheck: short-circuits to a trivial pass when there are no files", () => {
  const result = runCompileCheck("/nonexistent", []);
  assert.equal(result.passed, true);
});
