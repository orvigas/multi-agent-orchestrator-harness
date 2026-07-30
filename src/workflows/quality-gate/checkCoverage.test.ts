import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCoverageOutput, checkCoverageNode } from "./nodes/checkCoverage.js";
import { createSandbox, cleanupSandbox } from "../implementation/tools/sandbox.js";

test("parseCoverageOutput: extracts the line-coverage percentage from a real Node coverage report", () => {
  const sample = [
    "# start of coverage report",
    "# ----------------------------------------------------------",
    "# file      | line % | branch % | funcs % | uncovered lines",
    "# ----------------------------------------------------------",
    "# all files | 72.00 |    99.28 |  44.20 | ",
    "# ----------------------------------------------------------",
    "# end of coverage report",
  ].join("\n");
  assert.equal(parseCoverageOutput(sample), 72.0);
});

test("parseCoverageOutput: returns 0 when there's no recognizable summary line", () => {
  assert.equal(parseCoverageOutput("no coverage report here"), 0);
});

test("checkCoverageNode: runs real coverage against a real sandbox and returns a genuine delta shape", async () => {
  const sandbox = createSandbox("qg-coverage-test");
  try {
    const result = await checkCoverageNode({
      targetPath: process.cwd(),
      validationEvidence: [],
      plan: null,
      task: null,
      patch: null,
      sandboxPath: sandbox.path,
      coverageDelta: null,
      sonarResult: null,
      architectureReview: null,
      documentationReview: null,
      issues: [],
      verdict: "clear",
    });

    assert.ok(result.coverageDelta.beforePct >= 0 && result.coverageDelta.beforePct <= 100);
    assert.ok(result.coverageDelta.afterPct >= 0 && result.coverageDelta.afterPct <= 100);
    assert.equal(result.coverageDelta.thresholdPct, 0.5);
  } finally {
    cleanupSandbox(sandbox.path);
  }
});
