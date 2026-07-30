/**
 * Phase 4: Intelligent model downgrade strategy.
 * When a role exceeds its budget, try cheaper models before aborting.
 * Follows the principle: "try to succeed with less cost before giving up."
 */

export interface ModelOption {
  provider: string;
  model: string;
  tier: "expensive" | "moderate" | "cheap"; // Relative cost tier
  costMultiplier: number; // 1.0 = baseline, 0.5 = half cost
}

export interface DowngradeResult {
  shouldDowngrade: boolean;
  nextModel?: ModelOption;
  reason?: string; // Why downgrade or why not
}

/**
 * Phase 4: Determine if a role should attempt a cheaper model.
 *
 * Heuristic: if tokens used is close to limit (>80% of budget), try cheaper.
 */
export function shouldDowngradeModel(tokensUsed: number, tokenLimit: number): boolean {
  const budgetUsagePercent = (tokensUsed / tokenLimit) * 100;
  // If using >=80% of budget and haven't succeeded, try cheaper
  return budgetUsagePercent >= 80;
}

/**
 * Phase 4: Get downgrade chain for a role.
 * Most expensive → cheaper → cheapest.
 *
 * Hardcoded per-role chains (can be moved to config in Phase 4.x).
 */
export function getDowngradeChain(role: string): ModelOption[] {
  // Implementer: Opus (expensive) → Sonnet (moderate) → Haiku (cheap)
  if (role === "implementer") {
    return [
      { provider: "anthropic", model: "claude-opus-5", tier: "expensive", costMultiplier: 1.0 },
      { provider: "anthropic", model: "claude-sonnet-5", tier: "moderate", costMultiplier: 0.4 },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001", tier: "cheap", costMultiplier: 0.2 },
    ];
  }

  // Planner: Opus → Sonnet
  if (role === "planner") {
    return [
      { provider: "anthropic", model: "claude-opus-5", tier: "expensive", costMultiplier: 1.0 },
      { provider: "anthropic", model: "claude-sonnet-5", tier: "moderate", costMultiplier: 0.4 },
    ];
  }

  // Discovery: Sonnet → Haiku
  if (role === "discovery") {
    return [
      { provider: "anthropic", model: "claude-sonnet-5", tier: "moderate", costMultiplier: 1.0 },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001", tier: "cheap", costMultiplier: 0.5 },
    ];
  }

  // Default: no downgrade available
  return [];
}

/**
 * Phase 4: Get next cheaper model to try.
 * Looks at the downgrade chain and returns the model cheaper than currentModel.
 */
export function getNextCheaperModel(
  role: string,
  currentModel: string
): DowngradeResult {
  const chain = getDowngradeChain(role);

  // Find current model in chain
  const currentIndex = chain.findIndex((m) => m.model === currentModel);
  if (currentIndex === -1) {
    return {
      shouldDowngrade: false,
      reason: `Current model "${currentModel}" not in downgrade chain for ${role}`,
    };
  }

  // If not the last model, return the next one
  if (currentIndex < chain.length - 1) {
    const nextModel = chain[currentIndex + 1];
    return {
      shouldDowngrade: true,
      nextModel,
      reason: `Downgrade from ${currentModel} to ${nextModel.model} (${(nextModel.costMultiplier * 100).toFixed(0)}% cost)`,
    };
  }

  // Already at cheapest model
  return {
    shouldDowngrade: false,
    reason: `Already at cheapest model for ${role}: ${currentModel}`,
  };
}

/**
 * Phase 4: Format downgrade decision for logging.
 */
export function formatDowngradeDecision(result: DowngradeResult): string {
  if (!result.shouldDowngrade) {
    return `ℹ️  No downgrade available: ${result.reason || "unknown reason"}`;
  }

  return `↙️  Downgrading: ${result.reason}`;
}
