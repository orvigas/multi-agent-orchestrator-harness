import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleReportNode } from "./nodes/assembleReport.js";
import { reviewArchitectureNode } from "./nodes/reviewArchitecture.js";
import { reviewDocumentationNode } from "./nodes/reviewDocumentation.js";
import type { QualityGateStateType } from "./state.js";

function baseState(overrides: Partial<QualityGateStateType> = {}): QualityGateStateType {
  return {
    validationEvidence: [],
    plan: null,
    task: { id: "task-1", description: "demo", touchesFiles: ["src/foo.ts"] },
    patch: null,
    sandboxPath: "/tmp/sandbox",
    coverageDelta: null,
    sonarResult: null,
    architectureReview: null,
    documentationReview: null,
    issues: [],
    verdict: "clear",
    ...overrides,
  };
}

test("assembleReportNode: clear when nothing is flagged", () => {
  const result = assembleReportNode(baseState());
  assert.equal(result.verdict, "clear");
  assert.deepEqual(result.issues, []);
});

test("assembleReportNode: relays a Validation Pipeline failure as blocking, mapped to the right dimension", () => {
  const result = assembleReportNode(
    baseState({ validationEvidence: [{ stage: "lint", passed: false, durationMs: 1, exitCode: 1, evidence: "x" }] })
  );
  assert.equal(result.verdict, "blocking");
  assert.equal(result.issues[0].dimension, "Formatting");
  assert.equal(result.issues[0].severity, "blocking");
});

test("assembleReportNode: coverage drop under maxDropPct is not reported", () => {
  const result = assembleReportNode(
    baseState({ coverageDelta: { beforePct: 80, afterPct: 79.9, thresholdPct: 0.5 } })
  );
  assert.equal(result.verdict, "clear");
});

test("assembleReportNode: coverage drop over blockingDropPct is blocking", () => {
  const result = assembleReportNode(
    baseState({ coverageDelta: { beforePct: 80, afterPct: 70, thresholdPct: 0.5 } })
  );
  assert.equal(result.issues[0].dimension, "Coverage");
  assert.equal(result.issues[0].severity, "blocking");
  assert.equal(result.verdict, "blocking");
});

test("assembleReportNode: coverage drop between the two thresholds is advisory only", () => {
  const result = assembleReportNode(
    baseState({ coverageDelta: { beforePct: 80, afterPct: 78, thresholdPct: 0.5 } })
  );
  assert.equal(result.issues[0].severity, "advisory");
  assert.equal(result.verdict, "advisory_only");
});

test("assembleReportNode: sonar findings under the blocking threshold are advisory", () => {
  const result = assembleReportNode(
    baseState({ sonarResult: { newCodeSmells: 1, newDuplicationPct: 0, qualityGatePassed: false } })
  );
  assert.equal(result.issues[0].dimension, "Sonar");
  assert.equal(result.issues[0].severity, "advisory");
  assert.equal(result.verdict, "advisory_only");
});

test("assembleReportNode: sonar findings over the blocking threshold block", () => {
  const result = assembleReportNode(
    baseState({ sonarResult: { newCodeSmells: 999, newDuplicationPct: 0, qualityGatePassed: false } })
  );
  assert.equal(result.issues[0].severity, "blocking");
});

test("assembleReportNode: an architecture violation always blocks", () => {
  const result = assembleReportNode(
    baseState({ architectureReview: { compliant: false, findings: ["crosses two layers"] } })
  );
  assert.equal(result.issues[0].dimension, "Architecture");
  assert.equal(result.issues[0].severity, "blocking");
  assert.equal(result.verdict, "blocking");
});

test("assembleReportNode: a documentation gap never blocks by itself", () => {
  const result = assembleReportNode(
    baseState({ documentationReview: { compliant: false, findings: ["missing doc update"] } })
  );
  assert.equal(result.issues[0].dimension, "Documentation");
  assert.equal(result.issues[0].severity, "advisory");
  assert.equal(result.verdict, "advisory_only");
});

test("reviewArchitectureNode: compliant when a task touches only one workflow layer", () => {
  const result = reviewArchitectureNode(
    baseState({ task: { id: "t", description: "d", touchesFiles: ["src/workflows/planner/nodes/planning.ts"] } })
  );
  assert.equal(result.architectureReview.compliant, true);
});

test("reviewArchitectureNode: non-compliant when a task crosses two workflow layers", () => {
  const result = reviewArchitectureNode(
    baseState({
      task: {
        id: "t",
        description: "d",
        touchesFiles: ["src/workflows/planner/nodes/planning.ts", "src/workflows/implementation/graph.ts"],
      },
    })
  );
  assert.equal(result.architectureReview.compliant, false);
});

test("reviewDocumentationNode: compliant when touching non-public files", () => {
  const result = reviewDocumentationNode(baseState({ task: { id: "t", description: "d", touchesFiles: ["src/foo.ts"] } }));
  assert.equal(result.documentationReview.compliant, true);
});

test("reviewDocumentationNode: non-compliant touching package.json without touching any doc", () => {
  const result = reviewDocumentationNode(
    baseState({ task: { id: "t", description: "d", touchesFiles: ["package.json"] } })
  );
  assert.equal(result.documentationReview.compliant, false);
});

test("reviewDocumentationNode: compliant touching package.json AND a doc file in the same patch", () => {
  const result = reviewDocumentationNode(
    baseState({ task: { id: "t", description: "d", touchesFiles: ["package.json", ".claude/CLAUDE.md"] } })
  );
  assert.equal(result.documentationReview.compliant, true);
});
