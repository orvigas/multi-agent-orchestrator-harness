import { test } from "node:test";
import assert from "node:assert/strict";
import { routeStrategy } from "./nodes/routing.js";
import { decideStrategyNode } from "./nodes/decideStrategy.js";
import { diagnoseNode } from "./nodes/diagnose.js";
import type { RecoveryStateType } from "./state.js";
import type { Diagnosis } from "./types.js";

function baseState(overrides: Partial<RecoveryStateType> = {}): RecoveryStateType {
  return {
    targetPath: process.cwd(),
    failureCategory: "Tests",
    validationEvidence: [],
    patchAttempts: [],
    qualityGateIssues: [],
    mergeConflict: null,
    recoveryHistory: [],
    failedTask: { id: "task-1", description: "demo", touchesFiles: ["src/foo.ts"] },
    failedSandboxPath: null,
    diagnosis: null,
    strategy: "retry",
    targetedFixTask: null,
    recoveryIteration: 0,
    maxRecoveryIterations: 3,
    ...overrides,
  };
}

function diagnosis(overrides: Partial<Diagnosis> = {}): Diagnosis {
  return { rootCause: "Tests", detail: "algo falló", confidence: "high", isRepeatedFailure: false, ...overrides };
}

test("routeStrategy: rollback and abort route directly, everything else routes to fix", () => {
  assert.equal(routeStrategy(baseState({ strategy: "rollback" })), "rollback");
  assert.equal(routeStrategy(baseState({ strategy: "abort" })), "abort");
  assert.equal(routeStrategy(baseState({ strategy: "retry" })), "fix");
  assert.equal(routeStrategy(baseState({ strategy: "partial_retry" })), "fix");
  assert.equal(routeStrategy(baseState({ strategy: "change_context" })), "fix");
  assert.equal(routeStrategy(baseState({ strategy: "change_model" })), "fix");
});

test("decideStrategyNode: hard rule 1 - aborts once recovery iterations are exhausted, regardless of diagnosis", () => {
  const result = decideStrategyNode(
    baseState({ diagnosis: diagnosis({ rootCause: "Tests" }), recoveryIteration: 3, maxRecoveryIterations: 3 })
  );
  assert.equal(result.strategy, "abort");
});

test("decideStrategyNode: hard rule 2 - Security always aborts, even with budget left and not repeated", () => {
  const result = decideStrategyNode(
    baseState({ diagnosis: diagnosis({ rootCause: "Security", isRepeatedFailure: false }), recoveryIteration: 0 })
  );
  assert.equal(result.strategy, "abort");
});

test("decideStrategyNode: hard rule 2b - MergeConflict always aborts, even with budget left and not repeated", () => {
  const result = decideStrategyNode(
    baseState({ diagnosis: diagnosis({ rootCause: "MergeConflict", isRepeatedFailure: false }), recoveryIteration: 0 })
  );
  assert.equal(result.strategy, "abort");
});

test("decideStrategyNode: hard rule 3 - repeated Architecture/Dependencies failure forces change_context", () => {
  const arch = decideStrategyNode(
    baseState({ diagnosis: diagnosis({ rootCause: "Architecture", isRepeatedFailure: true }) })
  );
  assert.equal(arch.strategy, "change_context");

  const deps = decideStrategyNode(
    baseState({ diagnosis: diagnosis({ rootCause: "Dependencies", isRepeatedFailure: true }) })
  );
  assert.equal(deps.strategy, "change_context");
});

test("decideStrategyNode: hard rule 3 - repeated non-Architecture/Dependencies failure forces change_model", () => {
  const result = decideStrategyNode(
    baseState({ diagnosis: diagnosis({ rootCause: "Tests", isRepeatedFailure: true }) })
  );
  assert.equal(result.strategy, "change_model");
});

test("decideStrategyNode: first-time low-confidence failure retries", () => {
  const result = decideStrategyNode(
    baseState({ diagnosis: diagnosis({ rootCause: "Tests", confidence: "low", isRepeatedFailure: false }) })
  );
  assert.equal(result.strategy, "retry");
});

test("decideStrategyNode: first-time high-confidence failure with multiple prior patch attempts rolls back", () => {
  const attempt = {
    iteration: 1,
    patch: { taskId: "t", hunks: [], rationale: "r" },
    quickCheckResult: { passed: false, signal: "compile" as const, detail: "x" },
  };
  const result = decideStrategyNode(
    baseState({
      diagnosis: diagnosis({ rootCause: "Tests", confidence: "high", isRepeatedFailure: false }),
      patchAttempts: [attempt, attempt],
    })
  );
  assert.equal(result.strategy, "rollback");
});

test("decideStrategyNode: increments recoveryIteration every call", () => {
  const result = decideStrategyNode(baseState({ diagnosis: diagnosis(), recoveryIteration: 1 }));
  assert.equal(result.recoveryIteration, 2);
});

test("diagnoseNode: maps failureCategory to its base rootCause", () => {
  assert.equal(diagnoseNode(baseState({ failureCategory: "Tests", validationEvidence: [] })).diagnosis.rootCause, "Tests");
  assert.equal(
    diagnoseNode(baseState({ failureCategory: "Formatting", validationEvidence: [] })).diagnosis.rootCause,
    "Formatting"
  );
  assert.equal(
    diagnoseNode(baseState({ failureCategory: "Security", validationEvidence: [] })).diagnosis.rootCause,
    "Security"
  );
});

test("diagnoseNode: maps StaticAnalysis to Architecture and Performance to Runtime", () => {
  assert.equal(
    diagnoseNode(baseState({ failureCategory: "StaticAnalysis", validationEvidence: [] })).diagnosis.rootCause,
    "Architecture"
  );
  assert.equal(
    diagnoseNode(baseState({ failureCategory: "Performance", validationEvidence: [] })).diagnosis.rootCause,
    "Runtime"
  );
});

test("diagnoseNode: reclassifies a Compilation failure as Architecture when evidence mentions a real forbidden-zone path", () => {
  const result = diagnoseNode(
    baseState({
      failureCategory: "Compilation",
      validationEvidence: [
        {
          stage: "compile",
          passed: false,
          durationMs: 1,
          exitCode: 2,
          evidence: "error TS2307: Cannot find module 'secrets/config' or its corresponding type declarations.",
        },
      ],
    })
  );
  assert.equal(result.diagnosis.rootCause, "Architecture");
});

test("diagnoseNode: an ordinary Compilation failure with no forbidden-zone mention stays Compilation", () => {
  const result = diagnoseNode(
    baseState({
      failureCategory: "Compilation",
      validationEvidence: [
        { stage: "compile", passed: false, durationMs: 1, exitCode: 2, evidence: "error TS2322: type mismatch" },
      ],
    })
  );
  assert.equal(result.diagnosis.rootCause, "Compilation");
});

test("diagnoseNode: detects isRepeatedFailure against recoveryHistory", () => {
  const evidence = [
    { stage: "tests" as const, passed: false, durationMs: 1, exitCode: 1, evidence: "AssertionError: boom" },
  ];
  const first = diagnoseNode(baseState({ failureCategory: "Tests", validationEvidence: evidence }));
  assert.equal(first.diagnosis.isRepeatedFailure, false);

  const second = diagnoseNode(
    baseState({
      failureCategory: "Tests",
      validationEvidence: evidence,
      recoveryHistory: [{ iteration: 1, diagnosis: first.diagnosis, strategyChosen: "retry" }],
    })
  );
  assert.equal(second.diagnosis.isRepeatedFailure, true);
});

test("diagnoseNode: falls back to qualityGateIssues when failureCategory is null (Capa 5 already passed)", () => {
  const result = diagnoseNode(
    baseState({
      failureCategory: null,
      validationEvidence: [],
      qualityGateIssues: [
        { dimension: "Sonar", severity: "blocking", evidence: "12 code smells nuevos", recommendation: "revisar" },
      ],
    })
  );
  assert.equal(result.diagnosis.rootCause, "Architecture");
  assert.equal(result.diagnosis.confidence, "high");
});

test("diagnoseNode: prefers a blocking qualityGateIssue over a non-blocking one", () => {
  const result = diagnoseNode(
    baseState({
      failureCategory: null,
      qualityGateIssues: [
        { dimension: "Documentation", severity: "advisory", evidence: "missing doc", recommendation: "x" },
        { dimension: "Coverage", severity: "blocking", evidence: "cobertura bajó 10pp", recommendation: "x" },
      ],
    })
  );
  assert.equal(result.diagnosis.rootCause, "Tests");
});

test("diagnoseNode: mergeConflict (Capa 8) takes priority over failureCategory/qualityGateIssues", () => {
  const result = diagnoseNode(
    baseState({
      failureCategory: null,
      qualityGateIssues: [],
      mergeConflict: { hasConflicts: true, files: ["src/foo.ts"] },
    })
  );
  assert.equal(result.diagnosis.rootCause, "MergeConflict");
  assert.equal(result.diagnosis.confidence, "high");
  assert.ok(result.diagnosis.detail.includes("src/foo.ts"));
});
