import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceTokenBudget } from "./services/tokenBudgetEnforcer.js";
import { shouldDowngradeModel, getNextCheaperModel } from "./services/modelDowngradeStrategy.js";
import { CircuitBreaker } from "./services/llmCircuitBreaker.js";
import { isRateLimitError, isTimeoutError, LLMTimeoutError } from "./services/providerFallback.js";
import type { TokenUsageEvent } from "./services/tokenTracking.js";

/**
 * Phase 5: End-to-end integration tests.
 * Verify that the complete pipeline works with budget enforcement,
 * intelligent downgrade, circuit breaker, and timeout handling.
 */

test("e2e: full pipeline respects token budget", () => {
  // Simulate a complete run with multiple LLM calls
  const tokenEvents: TokenUsageEvent[] = [
    {
      timestamp: new Date().toISOString(),
      layer: "knowledge_engine",
      operation: "evidence_retrieval",
      tokensUsed: 15_000,
      reason: "discovery",
    },
    {
      timestamp: new Date().toISOString(),
      layer: "planner",
      operation: "plan_generation",
      tokensUsed: 35_000,
      reason: "planning",
    },
    {
      timestamp: new Date().toISOString(),
      layer: "implementation",
      operation: "patch_generation",
      tokensUsed: 45_000,
      reason: "implementer",
    },
    {
      timestamp: new Date().toISOString(),
      layer: "validation_pipeline",
      operation: "quality_check",
      tokensUsed: 5_000,
      reason: "validation",
    },
  ];

  const tokenBudget = { limit: 100_000 };
  const costBudget = { limitUsd: 1.0 };

  const result = enforceTokenBudget(tokenEvents, tokenBudget, costBudget);

  // Total: 15+35+45+5 = 100K tokens (at limit)
  assert.equal(result.tokensUsed, 100_000);
  assert.ok(result.isWithinTokenBudget);
  assert.ok(result.isWithinCostBudget);
});

test("e2e: budget exceeded triggers downgrade consideration", () => {
  // Scenario: implementer call exceeds 80% of its budget
  const implementerTokens = 160_000; // 80% of 200K role budget
  const roleTokenLimit = 200_000;

  // Should consider downgrade
  assert.ok(shouldDowngradeModel(implementerTokens, roleTokenLimit));

  // Try to get next cheaper model
  const downgrade = getNextCheaperModel("implementer", "claude-opus-5");
  assert.ok(downgrade.shouldDowngrade);
  assert.equal(downgrade.nextModel?.model, "claude-sonnet-5");
  assert.ok(downgrade.nextModel?.costMultiplier < 1.0);
});

test("e2e: circuit breaker prevents cascading failures", () => {
  const cb = new CircuitBreaker({ failureThreshold: 3 });

  // Simulate 3 failures
  cb.recordFailure("anthropic", "claude-opus-5");
  cb.recordFailure("anthropic", "claude-opus-5");
  cb.recordFailure("anthropic", "claude-opus-5");

  // Circuit should be open now
  assert.ok(!cb.isAvailable("anthropic", "claude-opus-5"));

  // But the retry loop should fallback to next provider
  assert.ok(cb.isAvailable("openai", "gpt-4-turbo")); // Different provider available
});

test("e2e: timeout error is classified correctly", () => {
  const timeoutErr = new LLMTimeoutError("anthropic", "claude-opus-5", 30_000);

  assert.ok(isTimeoutError(timeoutErr));
  assert.ok(!isRateLimitError(timeoutErr)); // Not a rate limit

  assert.equal(timeoutErr.provider, "anthropic");
  assert.equal(timeoutErr.timeoutMs, 30_000);
});

test("e2e: rate limit error is classified correctly", () => {
  const rateLimitErr = new Error("429 rate limit exceeded");

  assert.ok(isRateLimitError(rateLimitErr));
  assert.ok(!isTimeoutError(rateLimitErr)); // Not a timeout

  // Should trigger retry with backoff
});

test("e2e: recovery from transient failures via fallback", () => {
  // Simulate a complete recovery scenario with low threshold
  const cb = new CircuitBreaker({ failureThreshold: 2 });

  // Provider A fails twice with rate limit (hits threshold)
  cb.recordFailure("anthropic", "claude-opus-5");
  cb.recordFailure("anthropic", "claude-opus-5");

  // Retry loop now tries Provider B (different provider)
  assert.ok(cb.isAvailable("openai", "gpt-4-turbo"));

  // Eventually Provider B succeeds
  cb.recordSuccess("openai", "gpt-4-turbo");

  // Provider A is now open (after 2 failures)
  assert.ok(!cb.isAvailable("anthropic", "claude-opus-5"));

  // But Provider B is still available and successful
  assert.ok(cb.isAvailable("openai", "gpt-4-turbo"));
});

test("e2e: all layers contribute to token budget", () => {
  const allLayers: TokenUsageEvent[] = [
    // Knowledge Engine
    { timestamp: new Date().toISOString(), layer: "knowledge_engine", operation: "evidence_retrieval", tokensUsed: 20_000, reason: "discovery" },
    // Planner
    { timestamp: new Date().toISOString(), layer: "planner", operation: "plan_generation", tokensUsed: 30_000, reason: "planning" },
    { timestamp: new Date().toISOString(), layer: "planner", operation: "plan_validation", tokensUsed: 10_000, reason: "validation" },
    // Implementation
    { timestamp: new Date().toISOString(), layer: "implementation", operation: "patch_generation", tokensUsed: 50_000, reason: "implementer" },
    // Recovery (if needed)
    { timestamp: new Date().toISOString(), layer: "recovery", operation: "diagnosis", tokensUsed: 15_000, reason: "diagnostician" },
  ];

  const result = enforceTokenBudget(
    allLayers,
    { limit: 200_000 },
    { limitUsd: 2.0 }
  );

  // Total: 20+30+10+50+15 = 125K
  assert.equal(result.tokensUsed, 125_000);
  assert.ok(result.isWithinTokenBudget);
  assert.equal(result.tokensRemaining, 75_000);
});

test("e2e: cost budget independent of token budget", () => {
  // High tokens but low cost (cheap models)
  const events: TokenUsageEvent[] = [
    { timestamp: new Date().toISOString(), layer: "implementation", operation: "patch_generation", tokensUsed: 80_000, reason: "haiku" },
  ];

  // Token budget: only 50K (EXCEEDED)
  // Cost budget: $10 (within limit)
  const result = enforceTokenBudget(
    events,
    { limit: 50_000 },
    { limitUsd: 10.0 }
  );

  assert.ok(!result.isWithinTokenBudget); // Exceeded
  assert.ok(result.isWithinCostBudget); // Still within cost
  assert.equal(result.exceedanceReason, "tokens_exceeded");
});
