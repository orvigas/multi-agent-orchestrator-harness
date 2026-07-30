import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isRateLimitError,
  getFallbackProviders,
  calculateBackoffDelay,
  formatFallbackResult,
  selectOptimalModel,
  selectProviderWithFallback,
} from "./providerFallback.js";
import type { OrchestratorConfig } from "../config/loadConfig.js";

// Mock config for testing
const mockConfig: OrchestratorConfig = {
  roles: {
    discovery: { provider: "anthropic", model: "claude-sonnet-5" },
    planner: { provider: "anthropic", model: "claude-opus-4-8" },
    implementer: { provider: "anthropic", model: "claude-opus-4-8" },
    discovery_openai: { provider: "openai", model: "gpt-4-turbo" },
    planner_openai: { provider: "openai", model: "gpt-4-turbo" },
  },
  providers: {
    anthropic: { apiKeyEnv: "ANTHROPIC_API_KEY" },
    openai: { apiKeyEnv: "OPENAI_API_KEY" },
    openrouter: { apiKeyEnv: "OPENROUTER_API_KEY" },
  },
};

test("providerFallback: isRateLimitError detects Anthropic 429", () => {
  const error = new Error("Error 429: Too Many Requests");
  assert.ok(isRateLimitError(error));
});

test("providerFallback: isRateLimitError detects rate_limit_exceeded", () => {
  const error = new Error("rate_limit_exceeded");
  assert.ok(isRateLimitError(error));
});

test("providerFallback: isRateLimitError detects requests per minute", () => {
  const error = new Error("You exceeded your current quota, requests per minute");
  assert.ok(isRateLimitError(error));
});

test("providerFallback: isRateLimitError detects HTTP 429 status", () => {
  const error = { status: 429, message: "Too Many Requests" };
  assert.ok(isRateLimitError(error));
});

test("providerFallback: isRateLimitError returns false for non-rate-limit errors", () => {
  const error = new Error("Invalid API key");
  assert.ok(!isRateLimitError(error));
});

test("providerFallback: getFallbackProviders returns providers for role", () => {
  const providers = getFallbackProviders("discovery", mockConfig);
  assert.ok(providers.length > 0);
  assert.equal(providers[0]!.provider, "anthropic");
  assert.equal(providers[0]!.model, "claude-sonnet-5");
});

test("providerFallback: getFallbackProviders includes variant providers", () => {
  const providers = getFallbackProviders("discovery", mockConfig);
  // Should include both anthropic (primary) and openai (variant)
  const hasOpenAI = providers.some((p) => p.provider === "openai");
  assert.ok(hasOpenAI, "Should have OpenAI variant in fallback chain");
});

test("providerFallback: getFallbackProviders returns empty for unknown role", () => {
  const providers = getFallbackProviders("unknown_role", mockConfig);
  assert.equal(providers.length, 0);
});

test("providerFallback: calculateBackoffDelay increases exponentially", () => {
  const delay0 = calculateBackoffDelay(0);
  const delay1 = calculateBackoffDelay(1);
  const delay2 = calculateBackoffDelay(2);

  assert.ok(delay1 > delay0, "Delay should increase for each retry");
  assert.ok(delay2 > delay1, "Delay should continue increasing");
});

test("providerFallback: calculateBackoffDelay caps at 30 seconds", () => {
  const delayHighAttempt = calculateBackoffDelay(20);
  assert.ok(delayHighAttempt <= 30_000, "Delay should not exceed 30 seconds");
});

test("providerFallback: calculateBackoffDelay has jitter", () => {
  // Run multiple times to check for randomness
  const delays = Array.from({ length: 10 }, (_, i) => calculateBackoffDelay(1));
  const unique = new Set(delays);
  // With jitter, we should get different values (unlikely to get same delay 10x)
  assert.ok(unique.size > 1, "Jitter should produce varying delays");
});

test("providerFallback: formatFallbackResult shows single provider", () => {
  const result = {
    selectedProvider: "anthropic",
    selectedModel: "claude-sonnet-5",
    attempts: [{ provider: "anthropic", model: "claude-sonnet-5", status: "success" as const }],
    finalStatus: "success" as const,
  };

  const formatted = formatFallbackResult(result);
  assert.ok(formatted.includes("anthropic"));
  assert.ok(formatted.includes("claude-sonnet-5"));
  assert.ok(formatted.includes("success"));
});

test("providerFallback: formatFallbackResult shows fallback chain", () => {
  const result = {
    selectedProvider: "openai",
    selectedModel: "gpt-4-turbo",
    attempts: [
      { provider: "anthropic", model: "claude-opus-4-8", status: "rate_limited" as const, error: "429" },
      { provider: "openai", model: "gpt-4-turbo", status: "success" as const },
    ],
    finalStatus: "success" as const,
  };

  const formatted = formatFallbackResult(result);
  assert.ok(formatted.includes("Fallback chain"));
  assert.ok(formatted.includes("anthropic"));
  assert.ok(formatted.includes("openai"));
  assert.ok(formatted.includes("rate_limited"));
});

test("providerFallback: selectOptimalModel downgrades opus to sonnet for simple tasks", () => {
  const result = selectOptimalModel("claude-opus-4-8", "patch_review");
  assert.ok(result.includes("sonnet"), "Should downgrade to sonnet for patch_review");
});

test("providerFallback: selectOptimalModel upgrades sonnet to opus for complex tasks", () => {
  const result = selectOptimalModel("claude-sonnet-5", "plan_generation");
  assert.ok(result.includes("opus"), "Should upgrade to opus for plan_generation");
});

test("providerFallback: selectOptimalModel keeps model for neutral tasks", () => {
  const result = selectOptimalModel("claude-sonnet-5", "unknown_operation");
  assert.equal(result, "claude-sonnet-5", "Should not change model for unknown operations");
});

test("providerFallback: selectProviderWithFallback returns primary provider", async () => {
  const result = await selectProviderWithFallback("discovery", mockConfig);
  assert.equal(result.finalStatus, "success");
  assert.equal(result.selectedProvider, "anthropic");
});

test("providerFallback: selectProviderWithFallback handles unknown role", async () => {
  const result = await selectProviderWithFallback("unknown_role", mockConfig);
  assert.equal(result.finalStatus, "all_failed");
  assert.ok(result.attempts[0]!.error);
});
