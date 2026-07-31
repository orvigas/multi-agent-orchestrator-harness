import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recordTokenUsage,
  estimateTokensForOperation,
  summarizeTokenUsageByLayer,
  calculateBudgetStatus,
  formatBudgetStatus,
} from "./tokenTracking.js";
import type { TokenUsageEvent } from "./tokenTracking.js";

test("tokenTracking: recordTokenUsage creates event with correct structure", () => {
  const event = recordTokenUsage(
    "implementation",
    "patch_generation",
    "Test patch generation",
    "task-1",
    { example: "detail" }
  );

  assert.equal(event.layer, "implementation");
  assert.equal(event.operation, "patch_generation");
  assert.equal(event.reason, "Test patch generation");
  assert.equal(event.taskId, "task-1");
  assert.deepEqual(event.details, { example: "detail" });
  assert.ok(event.tokensUsed > 0, "Should have positive token estimate");
  assert.ok(event.timestamp, "Should have timestamp");
});

test("tokenTracking: estimateTokensForOperation returns consistent values", () => {
  const patchTokens = estimateTokensForOperation("patch_generation");
  const discoveryTokens = estimateTokensForOperation("discovery");

  assert.equal(patchTokens, 1500);
  assert.equal(discoveryTokens, 1000);
  assert.ok(patchTokens > 0);
  assert.ok(discoveryTokens > 0);
});

test("tokenTracking: summarizeTokenUsageByLayer groups by layer", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: "2026-07-30T12:00:00Z",
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 1500,
      reason: "Patch 1",
    },
    {
      timestamp: "2026-07-30T12:01:00Z",
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 1500,
      reason: "Patch 2",
    },
    {
      timestamp: "2026-07-30T12:02:00Z",
      layer: "planner",
      operation: "plan_generation",
      tokensUsed: 2000,
      reason: "Plan 1",
    },
  ];

  const summary = summarizeTokenUsageByLayer(events);

  assert.equal(summary.length, 2);
  assert.equal(summary[0].layer, "implementation");
  assert.equal(summary[0].totalTokens, 3000);
  assert.equal(summary[0].eventCount, 2);
  assert.equal(summary[1].layer, "planner");
  assert.equal(summary[1].totalTokens, 2000);
});

test("tokenTracking: calculateBudgetStatus shows usage and warnings", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: "2026-07-30T12:00:00Z",
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 50000,
      reason: "Multiple patches",
    },
    {
      timestamp: "2026-07-30T12:01:00Z",
      layer: "planner",
      operation: "plan_generation",
      tokensUsed: 40000,
      reason: "Plan generation",
    },
  ];

  const status = calculateBudgetStatus(90000, 100000, events);

  assert.equal(status.totalUsed, 90000);
  assert.equal(status.totalLimit, 100000);
  assert.equal(status.remaining, 10000);
  assert.equal(status.percentUsed, 90);
  assert.ok(status.warnings.length > 0, "Should have warnings at 90% usage");
  assert.ok(status.warnings[0].includes("90"), "Warning should mention percentage");
});

test("tokenTracking: formatBudgetStatus produces readable output", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: "2026-07-30T12:00:00Z",
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 1500,
      reason: "Patch",
    },
  ];

  const status = calculateBudgetStatus(1500, 10000, events);
  const formatted = formatBudgetStatus(status);

  assert.ok(formatted.includes("Token Budget Status"));
  assert.ok(formatted.includes("1500/10000"));
  assert.ok(formatted.includes("15.0%"));
  assert.ok(formatted.includes("implementation"));
});

test("tokenTracking: no warnings below 75% usage", () => {
  const events: TokenUsageEvent[] = [];
  const status = calculateBudgetStatus(10000, 100000, events);

  assert.equal(status.warnings.length, 0);
  assert.equal(status.percentUsed, 10);
});

test("tokenTracking: warning at 75% usage", () => {
  const events: TokenUsageEvent[] = [];
  const status = calculateBudgetStatus(75000, 100000, events);

  assert.ok(status.warnings.length > 0);
  assert.ok(status.warnings[0].includes("75"));
});

test("tokenTracking: operation breakdown tracks multiple operations per layer", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: "2026-07-30T12:00:00Z",
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 1500,
      reason: "Patch generation",
    },
    {
      timestamp: "2026-07-30T12:01:00Z",
      layer: "implementation",
      operation: "patch_review",
      tokensUsed: 800,
      reason: "Patch review",
    },
  ];

  const summary = summarizeTokenUsageByLayer(events);
  const implSummary = summary.find((s) => s.layer === "implementation");

  assert.ok(implSummary);
  assert.equal(implSummary!.operationBreakdown["patch_generation"], 1500);
  assert.equal(implSummary!.operationBreakdown["patch_review"], 800);
  assert.equal(implSummary!.totalTokens, 2300);
});
