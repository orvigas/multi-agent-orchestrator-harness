import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldDowngradeModel,
  getDowngradeChain,
  getNextCheaperModel,
  formatDowngradeDecision,
  type ModelOption,
} from "./modelDowngradeStrategy.js";

/**
 * Phase 4: Intelligent model downgrade tests.
 * When a role exceeds budget, try cheaper models before aborting.
 */

test("modelDowngrade: shouldDowngradeModel triggers at 80% budget usage", () => {
  const tokenLimit = 1000;

  // Below 80%: don't downgrade yet
  assert.ok(!shouldDowngradeModel(750, tokenLimit), "75% usage should not trigger downgrade");

  // At 80%: should downgrade
  assert.ok(shouldDowngradeModel(800, tokenLimit), "80% usage should trigger downgrade");

  // Above 80%: should downgrade
  assert.ok(shouldDowngradeModel(900, tokenLimit), "90% usage should trigger downgrade");

  // Already exceeded: should downgrade
  assert.ok(shouldDowngradeModel(1100, tokenLimit), "110% usage (over limit) should trigger downgrade");
});

test("modelDowngrade: getDowngradeChain returns chains for known roles", () => {
  const implementerChain = getDowngradeChain("implementer");
  const plannerChain = getDowngradeChain("planner");
  const discoveryChain = getDowngradeChain("discovery");

  // Implementer: Opus → Sonnet → Haiku (3 models)
  assert.equal(implementerChain.length, 3);
  assert.equal(implementerChain[0].model, "claude-opus-5");
  assert.equal(implementerChain[1].model, "claude-sonnet-5");
  assert.equal(implementerChain[2].model, "claude-haiku-4-5-20251001");

  // Planner: Opus → Sonnet (2 models)
  assert.equal(plannerChain.length, 2);
  assert.equal(plannerChain[0].model, "claude-opus-5");
  assert.equal(plannerChain[1].model, "claude-sonnet-5");

  // Discovery: Sonnet → Haiku (2 models)
  assert.equal(discoveryChain.length, 2);
  assert.equal(discoveryChain[0].model, "claude-sonnet-5");
  assert.equal(discoveryChain[1].model, "claude-haiku-4-5-20251001");
});

test("modelDowngrade: getDowngradeChain returns empty for unknown roles", () => {
  const chain = getDowngradeChain("unknown_role");
  assert.equal(chain.length, 0);
});

test("modelDowngrade: getNextCheaperModel downgrades Opus to Sonnet for implementer", () => {
  const result = getNextCheaperModel("implementer", "claude-opus-5");

  assert.ok(result.shouldDowngrade);
  assert.equal(result.nextModel?.model, "claude-sonnet-5");
  assert.equal(result.nextModel?.tier, "moderate");
  assert.equal(result.nextModel?.costMultiplier, 0.4); // 40% of Opus cost
});

test("modelDowngrade: getNextCheaperModel downgrades Sonnet to Haiku for implementer", () => {
  const result = getNextCheaperModel("implementer", "claude-sonnet-5");

  assert.ok(result.shouldDowngrade);
  assert.equal(result.nextModel?.model, "claude-haiku-4-5-20251001");
  assert.equal(result.nextModel?.tier, "cheap");
  assert.equal(result.nextModel?.costMultiplier, 0.2); // 20% of Opus cost
});

test("modelDowngrade: getNextCheaperModel rejects when at cheapest for implementer", () => {
  const result = getNextCheaperModel("implementer", "claude-haiku-4-5-20251001");

  assert.ok(!result.shouldDowngrade);
  assert.ok(result.reason?.includes("cheapest"));
});

test("modelDowngrade: getNextCheaperModel rejects unknown model", () => {
  const result = getNextCheaperModel("implementer", "unknown-model");

  assert.ok(!result.shouldDowngrade);
  assert.ok(result.reason?.includes("not in downgrade chain"));
});

test("modelDowngrade: getNextCheaperModel handles different roles independently", () => {
  // Planner Opus → Sonnet (cheaper available)
  const plannerResult = getNextCheaperModel("planner", "claude-opus-5");
  assert.ok(plannerResult.shouldDowngrade);
  assert.equal(plannerResult.nextModel?.model, "claude-sonnet-5");

  // Discovery Sonnet → Haiku (cheaper available)
  const discoveryResult = getNextCheaperModel("discovery", "claude-sonnet-5");
  assert.ok(discoveryResult.shouldDowngrade);
  assert.equal(discoveryResult.nextModel?.model, "claude-haiku-4-5-20251001");
});

test("modelDowngrade: formatDowngradeDecision shows readable output for downgrade", () => {
  const result = getNextCheaperModel("implementer", "claude-opus-5");
  const formatted = formatDowngradeDecision(result);

  assert.ok(formatted.includes("↙️")); // Downgrade icon
  assert.ok(formatted.includes("claude-sonnet-5"));
  assert.ok(formatted.includes("40%")); // Cost percentage
});

test("modelDowngrade: formatDowngradeDecision shows readable output for no downgrade", () => {
  const result = getNextCheaperModel("implementer", "claude-haiku-4-5-20251001");
  const formatted = formatDowngradeDecision(result);

  assert.ok(formatted.includes("ℹ️")); // Info icon
  assert.ok(formatted.includes("cheapest"));
});

test("modelDowngrade: cost multipliers are lower for cheaper models", () => {
  const chain = getDowngradeChain("implementer");

  // Each model should be progressively cheaper
  assert.ok(chain[0].costMultiplier > chain[1].costMultiplier);
  assert.ok(chain[1].costMultiplier > chain[2].costMultiplier);

  // Haiku is ~20% cost of Opus
  assert.ok(chain[2].costMultiplier < 0.3);
});
