import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkSonarNode } from "./nodes/checkSonar.js";
import { createSandbox, cleanupSandbox } from "../implementation/tools/sandbox.js";
import type { QualityGateStateType } from "./state.js";

function baseState(overrides: Partial<QualityGateStateType>): QualityGateStateType {
  return {
    targetPath: process.cwd(),
    validationEvidence: [],
    plan: null,
    task: null,
    patch: null,
    sandboxPath: "",
    coverageDelta: null,
    sonarResult: null,
    architectureReview: null,
    documentationReview: null,
    issues: [],
    verdict: "clear",
    ...overrides,
  };
}

test("checkSonarNode: no touched files means no signal at all", async () => {
  const result = await checkSonarNode(baseState({ sandboxPath: "/tmp/unused", task: null }));
  assert.deepEqual(result.sonarResult, { newCodeSmells: 0, newDuplicationPct: 0, qualityGatePassed: true });
});

test("checkSonarNode: a real TODO comment is flagged as a real code smell (eslint-plugin-sonarjs)", async () => {
  const sandbox = createSandbox("qg-sonar-smell-test");
  try {
    const target = "src/orchestrator/types.ts";
    const filePath = path.join(sandbox.path, target);
    fs.appendFileSync(filePath, "\n// TODO: this is a real smell for the test\n");

    const result = await checkSonarNode(
      baseState({ sandboxPath: sandbox.path, task: { id: "t", description: "d", touchesFiles: [target] } })
    );

    assert.ok(result.sonarResult.newCodeSmells >= 1);
    assert.equal(result.sonarResult.qualityGatePassed, false);
  } finally {
    cleanupSandbox(sandbox.path);
  }
});

test("checkSonarNode: an untouched, clean file reports zero new smells", async () => {
  const sandbox = createSandbox("qg-sonar-clean-test");
  try {
    const result = await checkSonarNode(
      baseState({
        sandboxPath: sandbox.path,
        task: { id: "t", description: "d", touchesFiles: ["src/orchestrator/types.ts"] },
      })
    );
    assert.equal(result.sonarResult.newCodeSmells, 0);
    assert.equal(result.sonarResult.qualityGatePassed, true);
  } finally {
    cleanupSandbox(sandbox.path);
  }
});

test("checkSonarNode: detects real duplicated line blocks across touched files", async () => {
  const sandbox = createSandbox("qg-sonar-dup-test");
  try {
    const block = ["function pad() {", "  const a = 1;", "  const b = 2;", "  const c = 3;", "  const d = 4;", "  return a + b + c + d;", "}"].join(
      "\n"
    );
    const filePath = path.join(sandbox.path, "src", "dup-test-file.ts");
    fs.writeFileSync(filePath, `${block}\n\n${block}\n`);

    const result = await checkSonarNode(
      baseState({ sandboxPath: sandbox.path, task: { id: "t", description: "d", touchesFiles: ["src/dup-test-file.ts"] } })
    );

    assert.ok(result.sonarResult.newDuplicationPct > 0);
  } finally {
    cleanupSandbox(sandbox.path);
  }
});
