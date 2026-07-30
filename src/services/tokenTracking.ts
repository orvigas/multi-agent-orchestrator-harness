/**
 * Token tracking per layer and operation type.
 * Each layer reports its token usage with granular details.
 */

export type LayerName =
  | "orchestrator"
  | "knowledge_engine"
  | "planner"
  | "implementation"
  | "validation_pipeline"
  | "recovery"
  | "quality_gate"
  | "merge_manager";

export type OperationType =
  | "discovery"
  | "evidence_retrieval"
  | "evidence_ranking"
  | "plan_generation"
  | "plan_validation"
  | "patch_generation"
  | "patch_review"
  | "diagnosis"
  | "strategy_decision"
  | "quality_check"
  | "conflict_detection"
  | "merge_execution";

export interface TokenUsageEvent {
  timestamp: string;
  layer: LayerName;
  operation: OperationType;
  tokensUsed: number;
  reason: string;
  taskId?: string;
  details?: Record<string, unknown>;
}

export interface TokenLayerSummary {
  layer: LayerName;
  totalTokens: number;
  operationBreakdown: Record<OperationType, number>;
  eventCount: number;
}

export interface TokenBudgetStatus {
  totalLimit: number;
  totalUsed: number;
  remaining: number;
  percentUsed: number;
  layers: TokenLayerSummary[];
  warnings: string[];
}

/**
 * Record a token usage event.
 * Simulated: uses deterministic values per operation type.
 * Real: would integrate with LLM token counting.
 */
export function recordTokenUsage(
  layer: LayerName,
  operation: OperationType,
  reason: string,
  taskId?: string,
  details?: Record<string, unknown>
): TokenUsageEvent {
  const tokensUsed = estimateTokensForOperation(operation);
  const timestamp = new Date().toISOString();

  return {
    timestamp,
    layer,
    operation,
    tokensUsed,
    reason,
    taskId,
    details,
  };
}

/**
 * Estimate tokens for a given operation type (simulated).
 * In production, this would call the actual LLM token counter.
 */
export function estimateTokensForOperation(operation: OperationType): number {
  const estimates: Record<OperationType, number> = {
    discovery: 1000,
    evidence_retrieval: 500,
    evidence_ranking: 200,
    plan_generation: 2000,
    plan_validation: 1500,
    patch_generation: 1500,
    patch_review: 800,
    diagnosis: 1200,
    strategy_decision: 800,
    quality_check: 600,
    conflict_detection: 400,
    merge_execution: 200,
  };
  return estimates[operation] || 500;
}

/**
 * Summarize token usage by layer.
 */
export function summarizeTokenUsageByLayer(events: TokenUsageEvent[]): TokenLayerSummary[] {
  const layerMap = new Map<LayerName, TokenLayerSummary>();

  for (const event of events) {
    if (!layerMap.has(event.layer)) {
      layerMap.set(event.layer, {
        layer: event.layer,
        totalTokens: 0,
        operationBreakdown: {} as Record<OperationType, number>,
        eventCount: 0,
      });
    }

    const summary = layerMap.get(event.layer)!;
    summary.totalTokens += event.tokensUsed;
    summary.operationBreakdown[event.operation] = (summary.operationBreakdown[event.operation] ?? 0) + event.tokensUsed;
    summary.eventCount += 1;
  }

  return Array.from(layerMap.values()).sort((a, b) => b.totalTokens - a.totalTokens);
}

/**
 * Calculate budget status and warnings.
 */
export function calculateBudgetStatus(
  totalUsed: number,
  totalLimit: number,
  events: TokenUsageEvent[]
): TokenBudgetStatus {
  const remaining = totalLimit - totalUsed;
  const percentUsed = (totalUsed / totalLimit) * 100;
  const layers = summarizeTokenUsageByLayer(events);

  const warnings: string[] = [];

  // Add warnings based on usage levels
  if (percentUsed >= 90) {
    warnings.push(`🚨 Critical: ${percentUsed.toFixed(1)}% of token budget used (${totalUsed}/${totalLimit})`);
  } else if (percentUsed >= 75) {
    warnings.push(`⚠️  Warning: ${percentUsed.toFixed(1)}% of token budget used (${totalUsed}/${totalLimit})`);
  }

  // Check for layers over-consuming
  for (const layer of layers) {
    const layerPercent = (layer.totalTokens / totalLimit) * 100;
    if (layerPercent > 30) {
      warnings.push(`⚠️  ${layer.layer} is using ${layerPercent.toFixed(1)}% of total budget`);
    }
  }

  return {
    totalLimit,
    totalUsed,
    remaining,
    percentUsed,
    layers,
    warnings,
  };
}

/**
 * Format token budget status for display.
 */
export function formatBudgetStatus(status: TokenBudgetStatus): string {
  const lines: string[] = [];

  lines.push("=== Token Budget Status ===");
  lines.push(`Total: ${status.totalUsed}/${status.totalLimit} (${status.percentUsed.toFixed(1)}% used)`);
  lines.push(`Remaining: ${status.remaining} tokens`);

  if (status.layers.length > 0) {
    lines.push("\nBy layer:");
    for (const layer of status.layers) {
      const layerPercent = (layer.totalTokens / status.totalLimit) * 100;
      lines.push(`  ${layer.layer}: ${layer.totalTokens} tokens (${layerPercent.toFixed(1)}%, ${layer.eventCount} events)`);
    }
  }

  if (status.warnings.length > 0) {
    lines.push("\nWarnings:");
    for (const warning of status.warnings) {
      lines.push(`  ${warning}`);
    }
  }

  return lines.join("\n");
}
