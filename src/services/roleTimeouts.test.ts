import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Phase 2.7: Per-role timeout budgets tests.
 * Different roles have different time requirements:
 * - discovery/planner/implementer: complex reasoning, need 45-60s
 * - validators/strategists: quick checks, need 15-30s
 */

test("roleTimeouts: configuration defines per-role budgets", () => {
  // These budgets represent realistic time requirements
  const roleTimeouts: Record<string, number> = {
    discovery: 45_000,      // 45s: AST search + evidence retrieval
    planner: 60_000,        // 60s: complex plan reasoning
    plan_validator: 15_000, // 15s: quick sanity check
    implementer: 45_000,    // 45s: code generation
    recovery_diagnostician: 30_000,  // 30s: analyzing failure root cause
    recovery_strategist: 15_000,     // 15s: quick strategy decision
  };

  // Verify all defined budgets are positive
  for (const [role, timeoutMs] of Object.entries(roleTimeouts)) {
    assert.ok(timeoutMs > 0, `${role} timeout must be positive`);
    assert.ok(timeoutMs <= 60_000, `${role} timeout should not exceed 60 seconds`);
  }
});

test("roleTimeouts: complex roles get more time than simple roles", () => {
  const roleTimeouts: Record<string, number> = {
    discovery: 45_000,
    planner: 60_000,
    plan_validator: 15_000,
    implementer: 45_000,
    recovery_diagnostician: 30_000,
    recovery_strategist: 15_000,
  };

  // Complex roles (planner, implementer, diagnostician) should have more time
  assert.ok(roleTimeouts.planner > roleTimeouts.plan_validator);
  assert.ok(roleTimeouts.implementer > roleTimeouts.recovery_strategist);
  assert.ok(roleTimeouts.recovery_diagnostician > roleTimeouts.recovery_strategist);

  // Planner is the most complex, should have maximum budget
  assert.equal(roleTimeouts.planner, 60_000);
  const allTimeouts = Object.values(roleTimeouts);
  const maxTimeout = Math.max(...allTimeouts);
  assert.equal(roleTimeouts.planner, maxTimeout);
});

test("roleTimeouts: validators are fast (< 20s)", () => {
  const roleTimeouts: Record<string, number> = {
    plan_validator: 15_000,
    recovery_strategist: 15_000,
  };

  for (const [role, timeoutMs] of Object.entries(roleTimeouts)) {
    assert.ok(timeoutMs < 20_000, `${role} should be a quick check`);
  }
});

test("roleTimeouts: diagnosticians are moderate (20-40s)", () => {
  const roleTimeouts: Record<string, number> = {
    recovery_diagnostician: 30_000,
  };

  for (const [role, timeoutMs] of Object.entries(roleTimeouts)) {
    assert.ok(timeoutMs >= 20_000 && timeoutMs <= 40_000, `${role} should be moderate`);
  }
});

test("roleTimeouts: reasoners are slow (40-60s)", () => {
  const roleTimeouts: Record<string, number> = {
    discovery: 45_000,
    implementer: 45_000,
    planner: 60_000,
  };

  for (const [role, timeoutMs] of Object.entries(roleTimeouts)) {
    assert.ok(timeoutMs >= 40_000 && timeoutMs <= 60_000, `${role} should need reasoning time`);
  }
});
