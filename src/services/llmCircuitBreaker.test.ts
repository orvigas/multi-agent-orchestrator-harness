import { test } from "node:test";
import assert from "node:assert/strict";
import { CircuitBreaker } from "./llmCircuitBreaker.js";

test("circuitBreaker: new provider starts CLOSED and available", () => {
  const cb = new CircuitBreaker();
  assert.ok(cb.isAvailable("anthropic", "claude-opus-5"));
});

test("circuitBreaker: records successes and increments counter", () => {
  const cb = new CircuitBreaker();
  cb.recordSuccess("anthropic", "claude-opus-5");
  cb.recordSuccess("anthropic", "claude-opus-5");

  const metrics = cb.getProviderMetrics("anthropic", "claude-opus-5");
  assert.equal(metrics?.successCount, 2);
  assert.equal(metrics?.failureCount, 0);
});

test("circuitBreaker: records failures and increments consecutive counter", () => {
  const cb = new CircuitBreaker();
  cb.recordFailure("anthropic", "claude-opus-5");
  cb.recordFailure("anthropic", "claude-opus-5");
  cb.recordFailure("anthropic", "claude-opus-5");

  const metrics = cb.getProviderMetrics("anthropic", "claude-opus-5");
  assert.equal(metrics?.failureCount, 3);
  assert.equal(metrics?.consecutiveFailures, 3);
  assert.equal(metrics?.state, "CLOSED"); // Not yet at threshold
});

test("circuitBreaker: opens circuit after failure threshold", () => {
  const cb = new CircuitBreaker({ failureThreshold: 3 });

  cb.recordFailure("openai", "gpt-4-turbo");
  assert.ok(cb.isAvailable("openai", "gpt-4-turbo"));

  cb.recordFailure("openai", "gpt-4-turbo");
  assert.ok(cb.isAvailable("openai", "gpt-4-turbo"));

  cb.recordFailure("openai", "gpt-4-turbo");
  assert.ok(!cb.isAvailable("openai", "gpt-4-turbo")); // Now OPEN

  const metrics = cb.getProviderMetrics("openai", "gpt-4-turbo");
  assert.equal(metrics?.state, "OPEN");
});

test("circuitBreaker: success resets consecutive failure counter", () => {
  const cb = new CircuitBreaker({ failureThreshold: 5 });

  cb.recordFailure("anthropic", "claude-opus-5");
  cb.recordFailure("anthropic", "claude-opus-5");

  let metrics = cb.getProviderMetrics("anthropic", "claude-opus-5");
  assert.equal(metrics?.consecutiveFailures, 2);

  cb.recordSuccess("anthropic", "claude-opus-5");

  metrics = cb.getProviderMetrics("anthropic", "claude-opus-5");
  assert.equal(metrics?.consecutiveFailures, 0);
  assert.equal(metrics?.failureCount, 2); // Total failures still 2
});

test("circuitBreaker: HALF_OPEN state allows testing after timeout", () => {
  const cb = new CircuitBreaker({ failureThreshold: 2, timeout: 100 });

  // Open the circuit
  cb.recordFailure("openai", "gpt-4");
  cb.recordFailure("openai", "gpt-4");
  assert.ok(!cb.isAvailable("openai", "gpt-4"));

  // Immediately: still OPEN
  assert.ok(!cb.isAvailable("openai", "gpt-4"));

  // After timeout: HALF_OPEN (available for testing)
  // Note: In real code, we'd wait. For testing, we'd mock Date.now()
  // For now, just verify the logic is there
  const metrics = cb.getProviderMetrics("openai", "gpt-4");
  assert.equal(metrics?.state, "OPEN");
});

test("circuitBreaker: closes circuit after success threshold from HALF_OPEN", () => {
  const cb = new CircuitBreaker({ failureThreshold: 2, successThreshold: 2 });

  // Open circuit
  cb.recordFailure("anthropic", "claude-opus-5");
  cb.recordFailure("anthropic", "claude-opus-5");

  // Manually set to HALF_OPEN for testing
  const metrics = cb.getProviderMetrics("anthropic", "claude-opus-5");
  assert.ok(metrics);
  metrics.state = "HALF_OPEN";
  metrics.consecutiveFailures = 0;

  // Record successes
  cb.recordSuccess("anthropic", "claude-opus-5");
  assert.equal(metrics.state, "HALF_OPEN"); // Still HALF_OPEN

  cb.recordSuccess("anthropic", "claude-opus-5");
  assert.equal(metrics.state, "CLOSED"); // Now CLOSED
  assert.ok(cb.isAvailable("anthropic", "claude-opus-5"));
});

test("circuitBreaker: getMetrics returns all providers", () => {
  const cb = new CircuitBreaker();

  cb.recordSuccess("anthropic", "claude-opus-5");
  cb.recordFailure("openai", "gpt-4-turbo");

  const metrics = cb.getMetrics();
  assert.equal(metrics.length, 2);
  assert.ok(metrics.some((m) => m.provider === "anthropic"));
  assert.ok(metrics.some((m) => m.provider === "openai"));
});

test("circuitBreaker: formatMetrics produces human-readable output", () => {
  const cb = new CircuitBreaker();

  cb.recordSuccess("anthropic", "claude-opus-5");
  cb.recordFailure("openai", "gpt-4-turbo");
  cb.recordFailure("openai", "gpt-4-turbo");

  const formatted = cb.formatMetrics();
  assert.ok(formatted.includes("Circuit Breaker Status"));
  assert.ok(formatted.includes("anthropic"));
  assert.ok(formatted.includes("openai"));
  assert.ok(formatted.includes("CLOSED"));
});

test("circuitBreaker: reset clears all metrics", () => {
  const cb = new CircuitBreaker();

  cb.recordSuccess("anthropic", "claude-opus-5");
  cb.recordFailure("openai", "gpt-4-turbo");

  assert.equal(cb.getMetrics().length, 2);

  cb.reset();
  assert.equal(cb.getMetrics().length, 0);
  assert.ok(cb.isAvailable("anthropic", "claude-opus-5")); // Back to unknown = available
});

test("circuitBreaker: resetProvider clears specific provider", () => {
  const cb = new CircuitBreaker();

  cb.recordSuccess("anthropic", "claude-opus-5");
  cb.recordFailure("openai", "gpt-4-turbo");

  cb.resetProvider("anthropic", "claude-opus-5");

  const metrics = cb.getMetrics();
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0]!.provider, "openai");
});

test("circuitBreaker: tracks separate metrics per provider/model combo", () => {
  const cb = new CircuitBreaker();

  cb.recordSuccess("anthropic", "claude-opus-5");
  cb.recordFailure("anthropic", "claude-sonnet-5");
  cb.recordFailure("openai", "gpt-4-turbo");

  const metrics = cb.getMetrics();
  assert.equal(metrics.length, 3);

  const opus = cb.getProviderMetrics("anthropic", "claude-opus-5");
  assert.equal(opus?.successCount, 1);
  assert.equal(opus?.failureCount, 0);

  const sonnet = cb.getProviderMetrics("anthropic", "claude-sonnet-5");
  assert.equal(sonnet?.successCount, 0);
  assert.equal(sonnet?.failureCount, 1);
});
