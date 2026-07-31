/**
 * Phase 3: Token budget enforcement.
 * Tracks cumulative token usage across a run and escalates when limits are exceeded.
 * Prevents runaway costs when LLM calls are more expensive than anticipated.
 */

import type { TokenUsageEvent } from "./tokenTracking.js";

export interface TokenBudgetConfig {
  limit: number; // Max tokens for entire run (e.g., 200_000)
}

export interface CostBudgetConfig {
  limitUsd: number; // Max USD cost for entire run (e.g., 5.00)
}

export interface BudgetEnforcementResult {
  isWithinTokenBudget: boolean;
  isWithinCostBudget: boolean;
  tokensUsed: number;
  tokensRemaining: number;
  costUsedUsd: number;
  costRemainingUsd: number;
  exceedanceReason?: string; // If exceeding, why (e.g., "tokens_exceeded" | "cost_exceeded")
}

/**
 * Phase 3: Calculate current token usage from events.
 */
export function calculateTokenUsage(events: TokenUsageEvent[]): {
  totalTokens: number;
  totalCostUsd: number;
} {
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (const event of events) {
    totalTokens += event.tokensUsed;

    // Estimate cost: ~$0.006/1K tokens average (Claude 3 Sonnet, rough estimate)
    // Actual: input $0.003/1K, output $0.009/1K, but we track aggregated tokens
    const estimatedCost = (event.tokensUsed / 1000) * 0.006;
    totalCostUsd += estimatedCost;
  }

  return { totalTokens, totalCostUsd };
}

/**
 * Phase 3: Check if token/cost budgets are still within limits.
 * Returns detailed status and the reason if exceeding.
 */
export function enforceTokenBudget(
  events: TokenUsageEvent[],
  tokenBudgetConfig: TokenBudgetConfig,
  costBudgetConfig: CostBudgetConfig
): BudgetEnforcementResult {
  const { totalTokens, totalCostUsd } = calculateTokenUsage(events);
  const tokensRemaining = tokenBudgetConfig.limit - totalTokens;
  const costRemainingUsd = costBudgetConfig.limitUsd - totalCostUsd;

  const isWithinTokenBudget = totalTokens <= tokenBudgetConfig.limit;
  const isWithinCostBudget = totalCostUsd <= costBudgetConfig.limitUsd;

  let exceedanceReason: string | undefined;
  if (!isWithinTokenBudget && !isWithinCostBudget) {
    // Both exceeded: report tokens first (more common)
    exceedanceReason = "tokens_exceeded";
  } else if (!isWithinTokenBudget) {
    exceedanceReason = "tokens_exceeded";
  } else if (!isWithinCostBudget) {
    exceedanceReason = "cost_exceeded";
  }

  return {
    isWithinTokenBudget,
    isWithinCostBudget,
    tokensUsed: totalTokens,
    tokensRemaining,
    costUsedUsd: totalCostUsd,
    costRemainingUsd,
    exceedanceReason,
  };
}

/**
 * Format budget enforcement result for logging.
 */
export function formatBudgetStatus(result: BudgetEnforcementResult): string {
  const tokenPct = ((result.tokensUsed / (result.tokensUsed + result.tokensRemaining)) * 100).toFixed(1);
  const costPct = ((result.costUsedUsd / (result.costUsedUsd + result.costRemainingUsd)) * 100).toFixed(1);

  const tokenStatus = result.isWithinTokenBudget ? "✅" : "❌";
  const costStatus = result.isWithinCostBudget ? "✅" : "❌";

  const lines: string[] = [];
  lines.push(`Token Budget: ${tokenStatus} ${result.tokensUsed} / ${result.tokensUsed + result.tokensRemaining} (${tokenPct}%)`);
  lines.push(`Cost Budget: ${costStatus} $${result.costUsedUsd.toFixed(3)} / $${(result.costUsedUsd + result.costRemainingUsd).toFixed(3)} (${costPct}%)`);

  if (result.exceedanceReason) {
    lines.push(`⚠️  Exceeded: ${result.exceedanceReason}`);
  }

  return lines.join("\n");
}
