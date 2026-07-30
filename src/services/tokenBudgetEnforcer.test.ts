import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTokenUsage,
  enforceTokenBudget,
  formatBudgetStatus,
  type TokenBudgetConfig,
  type CostBudgetConfig,
} from "./tokenBudgetEnforcer.js";
import type { TokenUsageEvent } from "./tokenTracking.js";

/**
 * Phase 3: Token budget enforcement tests.
 * Verify that token/cost budgets are tracked and enforced correctly.
 */

test("tokenBudgetEnforcer: calculateTokenUsage sums tokens from events", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: new Date().toISOString(),
      layer: "knowledge_engine",
      operation: "evidence_retrieval",
      tokensUsed: 1500,
      reason: "discovery",
    },
    {
      timestamp: new Date().toISOString(),
      layer: "planner",
      operation: "plan_generation",
      tokensUsed: 3500,
      reason: "planning",
    },
  ];

  const { totalTokens, totalCostUsd } = calculateTokenUsage(events);

  // Total: 1500 + 3500 = 5000 tokens
  assert.equal(totalTokens, 5000);

  // Estimated cost: (5000 / 1000) * 0.006 = 0.03
  assert.ok(Math.abs(totalCostUsd - 0.03) < 0.001, "Cost calculation should be approximately correct");
});

test("tokenBudgetEnforcer: enforceTokenBudget returns within budget when under limit", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: new Date().toISOString(),
      layer: "knowledge_engine",
      operation: "evidence_retrieval",
      tokensUsed: 1500,
      reason: "discovery",
    },
  ];

  const tokenBudget: TokenBudgetConfig = { limit: 200_000 };
  const costBudget: CostBudgetConfig = { limitUsd: 5 };

  const result = enforceTokenBudget(events, tokenBudget, costBudget);

  assert.ok(result.isWithinTokenBudget);
  assert.ok(result.isWithinCostBudget);
  assert.equal(result.tokensUsed, 1500);
  assert.equal(result.tokensRemaining, 200_000 - 1500);
  assert.ok(!result.exceedanceReason);
});

test("tokenBudgetEnforcer: detects token budget exceeded", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: new Date().toISOString(),
      layer: "knowledge_engine",
      operation: "evidence_retrieval",
      tokensUsed: 210_000,
      reason: "discovery",
    },
  ];

  const tokenBudget: TokenBudgetConfig = { limit: 200_000 };
  const costBudget: CostBudgetConfig = { limitUsd: 100 };

  const result = enforceTokenBudget(events, tokenBudget, costBudget);

  assert.ok(!result.isWithinTokenBudget);
  assert.ok(result.isWithinCostBudget);
  assert.equal(result.exceedanceReason, "tokens_exceeded");
});

test("tokenBudgetEnforcer: detects cost budget exceeded", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: new Date().toISOString(),
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 100_000,
      reason: "implementer",
    },
    {
      timestamp: new Date().toISOString(),
      layer: "planner",
      operation: "plan_generation",
      tokensUsed: 50_000,
      reason: "planner",
    },
  ];

  const tokenBudget: TokenBudgetConfig = { limit: 1_000_000 };
  const costBudget: CostBudgetConfig = { limitUsd: 0.5 };

  const result = enforceTokenBudget(events, tokenBudget, costBudget);

  // Tokens: 100000 + 50000 = 150000 (well under 1M)
  assert.ok(result.isWithinTokenBudget);
  // Cost: (150000 / 1000) * 0.006 = 0.9 USD (exceeds 0.5)
  assert.ok(!result.isWithinCostBudget);
  assert.equal(result.exceedanceReason, "cost_exceeded");
});

test("tokenBudgetEnforcer: both budgets exceeded prefers token exceedance in reason", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: new Date().toISOString(),
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 250_000,
      reason: "implementer",
    },
  ];

  const tokenBudget: TokenBudgetConfig = { limit: 200_000 };
  const costBudget: CostBudgetConfig = { limitUsd: 1.0 };

  const result = enforceTokenBudget(events, tokenBudget, costBudget);

  assert.ok(!result.isWithinTokenBudget);
  assert.ok(!result.isWithinCostBudget);
  // Both exceeded, but tokens_exceeded is reported first
  assert.equal(result.exceedanceReason, "tokens_exceeded");
});

test("tokenBudgetEnforcer: formatBudgetStatus shows readable output", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: new Date().toISOString(),
      layer: "knowledge_engine",
      operation: "evidence_retrieval",
      tokensUsed: 50_000,
      reason: "discovery",
    },
  ];

  const tokenBudget: TokenBudgetConfig = { limit: 200_000 };
  const costBudget: CostBudgetConfig = { limitUsd: 5 };

  const result = enforceTokenBudget(events, tokenBudget, costBudget);
  const formatted = formatBudgetStatus(result);

  assert.ok(formatted.includes("✅")); // Within budget
  assert.ok(formatted.includes("Token Budget"));
  assert.ok(formatted.includes("Cost Budget"));
  assert.ok(formatted.includes("%")); // Percentage usage
  assert.ok(!formatted.includes("⚠️")); // No warning
});

test("tokenBudgetEnforcer: formatBudgetStatus shows warning when exceeded", () => {
  const events: TokenUsageEvent[] = [
    {
      timestamp: new Date().toISOString(),
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 220_000,
      reason: "implementer",
    },
  ];

  const tokenBudget: TokenBudgetConfig = { limit: 200_000 };
  const costBudget: CostBudgetConfig = { limitUsd: 5 };

  const result = enforceTokenBudget(events, tokenBudget, costBudget);
  const formatted = formatBudgetStatus(result);

  assert.ok(formatted.includes("❌")); // Over budget
  assert.ok(formatted.includes("⚠️")); // Warning icon
  assert.ok(formatted.includes("tokens_exceeded"));
});

test("tokenBudgetEnforcer: empty events array is within budget", () => {
  const events: TokenUsageEvent[] = [];

  const tokenBudget: TokenBudgetConfig = { limit: 200_000 };
  const costBudget: CostBudgetConfig = { limitUsd: 5 };

  const result = enforceTokenBudget(events, tokenBudget, costBudget);

  assert.ok(result.isWithinTokenBudget);
  assert.ok(result.isWithinCostBudget);
  assert.equal(result.tokensUsed, 0);
  assert.equal(result.tokensRemaining, 200_000);
  assert.equal(result.costRemainingUsd, 5);
});
