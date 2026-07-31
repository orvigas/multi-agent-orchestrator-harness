import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateAdaptiveBackoffMultiplier } from "./providerFallback.js";

/**
 * Phase 2.6: Adaptive backoff learning tests.
 * Strategy: if a provider is accumulating failures, multiply the exponential
 * backoff to give the service more time to recover.
 */

test("adaptiveBackoff: healthy provider (0 failures) gets normal backoff", () => {
  const multiplier = calculateAdaptiveBackoffMultiplier(0);
  assert.equal(multiplier, 1.0);
});

test("adaptiveBackoff: one failure still uses normal backoff", () => {
  const multiplier = calculateAdaptiveBackoffMultiplier(1);
  assert.equal(multiplier, 1.0);
});

test("adaptiveBackoff: two failures trigger modest increase (1.5x)", () => {
  const multiplier = calculateAdaptiveBackoffMultiplier(2);
  assert.equal(multiplier, 1.5);
});

test("adaptiveBackoff: three failures also get 1.5x (stressed)", () => {
  const multiplier = calculateAdaptiveBackoffMultiplier(3);
  assert.equal(multiplier, 1.5);
});

test("adaptiveBackoff: four failures get aggressive increase (2.5x)", () => {
  const multiplier = calculateAdaptiveBackoffMultiplier(4);
  assert.equal(multiplier, 2.5);
});

test("adaptiveBackoff: five failures (near circuit threshold) get 2.5x", () => {
  const multiplier = calculateAdaptiveBackoffMultiplier(5);
  assert.equal(multiplier, 2.5);
});

test("adaptiveBackoff: many failures cap at 2.5x", () => {
  const multiplier = calculateAdaptiveBackoffMultiplier(100);
  assert.equal(multiplier, 2.5);
});

test("adaptiveBackoff: multiplier applies to exponential delay", () => {
  // Base exponential: 100 * 2^attempt
  // Attempt 0: 100ms → with health (1.0x) = 100ms
  // Attempt 0: 100ms → with stress (1.5x) = 150ms
  // Attempt 0: 100ms → with critical (2.5x) = 250ms

  const baseDelay = 100;

  const healthyMultiplied = baseDelay * calculateAdaptiveBackoffMultiplier(0);
  assert.equal(healthyMultiplied, 100);

  const stressedMultiplied = baseDelay * calculateAdaptiveBackoffMultiplier(2);
  assert.equal(stressedMultiplied, 150);

  const criticalMultiplied = baseDelay * calculateAdaptiveBackoffMultiplier(4);
  assert.equal(criticalMultiplied, 250);
});

test("adaptiveBackoff: progression makes sense across thresholds", () => {
  // Verify that multiplier only increases or stays same as failures grow
  const results = [];
  for (let i = 0; i <= 6; i++) {
    results.push(calculateAdaptiveBackoffMultiplier(i));
  }

  // 0-1: 1.0, 1.0 (no change, healthy)
  assert.equal(results[0], 1.0);
  assert.equal(results[1], 1.0);

  // 2-3: 1.5, 1.5 (increase, stressed)
  assert.equal(results[2], 1.5);
  assert.equal(results[3], 1.5);

  // 4-6: 2.5, 2.5, 2.5 (increase, critical)
  assert.equal(results[4], 2.5);
  assert.equal(results[5], 2.5);
  assert.equal(results[6], 2.5);

  // Verify monotonic increase: each transition only goes up
  for (let i = 1; i < results.length; i++) {
    assert.ok(
      results[i] >= results[i - 1],
      `Multiplier should not decrease: position ${i - 1}=${results[i - 1]}, ${i}=${results[i]}`
    );
  }
});
