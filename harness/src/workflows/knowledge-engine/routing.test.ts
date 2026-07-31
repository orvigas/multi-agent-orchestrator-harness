import { test } from "node:test";
import assert from "node:assert/strict";
import { routeAfterVerification } from "./nodes/routing.js";
import type { KnowledgeStateType } from "./state.js";

function baseState(overrides: Partial<KnowledgeStateType> = {}): KnowledgeStateType {
  return { targetPath: process.cwd(),
    ticket: { id: "T-1", title: "demo" },
    triedQueries: [],
    discardedEvidence: [],
    confirmedEvidence: [],
    iteration: 0,
    maxIterations: 5,
    nextAction: null,
    sufficiency: "insufficient",
    retrievalConfig: null,
    evidencePackage: null,
    ...overrides,
  };
}

test("routeAfterVerification: sufficient wins outright regardless of iteration", () => {
  assert.equal(routeAfterVerification(baseState({ sufficiency: "sufficient", iteration: 0 })), "sufficient");
});

test("routeAfterVerification: escalates once maxIterations is reached", () => {
  assert.equal(
    routeAfterVerification(baseState({ sufficiency: "insufficient", iteration: 5, maxIterations: 5 })),
    "escalate"
  );
});

test("routeAfterVerification: narrows otherwise", () => {
  assert.equal(
    routeAfterVerification(baseState({ sufficiency: "insufficient", iteration: 2, maxIterations: 5 })),
    "narrow"
  );
});
