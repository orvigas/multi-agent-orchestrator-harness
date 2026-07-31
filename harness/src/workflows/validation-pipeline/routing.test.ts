import { test } from "node:test";
import assert from "node:assert/strict";
import { routeAfterCompile, routeAfterTests, routeAfterParallelChecks } from "./nodes/routing.js";
import { assembleVerdictNode } from "./nodes/assembleVerdict.js";
import type { ValidationStateType } from "./state.js";
import type { StageResult } from "./types.js";

function baseState(overrides: Partial<ValidationStateType> = {}): ValidationStateType {
  return {
    targetPath: process.cwd(),
    sandboxPath: "/tmp/sandbox",
    patch: null,
    task: null,
    results: [],
    verdict: null,
    failureCategory: null,
    ...overrides,
  };
}

function result(stage: StageResult["stage"], passed: boolean): StageResult {
  return { stage, passed, durationMs: 1, evidence: "", exitCode: passed ? 0 : 1 };
}

test("routeAfterCompile: continues when compile passed", () => {
  assert.equal(routeAfterCompile(baseState({ results: [result("compile", true)] })), "continue");
});

test("routeAfterCompile: fail_fast when compile failed", () => {
  assert.equal(routeAfterCompile(baseState({ results: [result("compile", false)] })), "fail_fast");
});

test("routeAfterTests: fans out to lint+static_analysis+security when tests passed", () => {
  assert.deepEqual(routeAfterTests(baseState({ results: [result("tests", true)] })), [
    "lint",
    "static_analysis",
    "security",
  ]);
});

test("routeAfterTests: goes straight to assemble_verdict when tests failed (no fan-out)", () => {
  assert.equal(routeAfterTests(baseState({ results: [result("tests", false)] })), "assemble_verdict");
});

test("routeAfterParallelChecks: continues only when all three parallel checks passed", () => {
  assert.equal(
    routeAfterParallelChecks(
      baseState({ results: [result("lint", true), result("static_analysis", true), result("security", true)] })
    ),
    "continue"
  );
});

test("routeAfterParallelChecks: fail_fast when any parallel check failed", () => {
  assert.equal(
    routeAfterParallelChecks(
      baseState({ results: [result("lint", true), result("static_analysis", false), result("security", true)] })
    ),
    "fail_fast"
  );
});

test("assembleVerdictNode: pass when nothing failed", () => {
  const out = assembleVerdictNode(baseState({ results: [result("compile", true), result("tests", true)] }));
  assert.equal(out.verdict, "pass");
});

test("assembleVerdictNode: maps the first failed stage to its FailureCategory", () => {
  const out = assembleVerdictNode(
    baseState({ results: [result("compile", true), result("tests", false), result("lint", true)] })
  );
  assert.equal(out.verdict, "fail");
  assert.equal(out.failureCategory, "Tests");
});

test("assembleVerdictNode: security failure maps to the Security category", () => {
  const out = assembleVerdictNode(baseState({ results: [result("security", false)] }));
  assert.equal(out.failureCategory, "Security");
});
