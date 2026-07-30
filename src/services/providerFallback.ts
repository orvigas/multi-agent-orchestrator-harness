/**
 * Multi-provider fallback for Phase 2.2: cost optimization & resilience.
 * Handles rate limits, retries with backoff, and provider selection.
 */

import type { OrchestratorConfig } from "../config/loadConfig.js";

export interface ProviderAttempt {
  provider: string;
  model: string;
  status: "success" | "rate_limited" | "unavailable" | "error";
  error?: string;
  tokensUsed?: number;
}

export interface ProviderFallbackResult {
  selectedProvider: string;
  selectedModel: string;
  attempts: ProviderAttempt[];
  finalStatus: "success" | "all_failed";
}

/**
 * Check if an error is a rate limit error.
 * Each provider has different error formats.
 */
export function isRateLimitError(error: unknown): boolean {
  const msg = (error as any)?.message?.toLowerCase() || "";

  // Anthropic rate limit errors
  if (msg.includes("rate limit") || msg.includes("429")) return true;
  if (msg.includes("overloaded")) return true;

  // OpenAI rate limit errors
  if (msg.includes("rate_limit_exceeded")) return true;
  if (msg.includes("requests per minute")) return true;

  // Generic HTTP 429
  if ((error as any)?.status === 429) return true;

  return false;
}

/**
 * Get fallback providers for a role.
 * Currently: [anthropic, openai, openrouter] in priority order.
 * Future: configurable fallback chains per role.
 */
export function getFallbackProviders(
  role: string,
  config: OrchestratorConfig
): Array<{ provider: string; model: string }> {
  const primaryConfig = config.roles[role];
  if (!primaryConfig) {
    return [];
  }

  const fallbackOrder = ["anthropic", "openai", "openrouter"];
  const results: Array<{ provider: string; model: string }> = [];

  for (const providerName of fallbackOrder) {
    // Look for a role variant for this provider
    // e.g., if role="discovery" and we want openai, look for "discovery_openai"
    const variantRole = `${role}_${providerName}`;
    const variantConfig = config.roles[variantRole];

    if (variantConfig && config.providers[variantConfig.provider]) {
      results.push({
        provider: variantConfig.provider,
        model: variantConfig.model,
      });
    } else if (providerName === primaryConfig.provider) {
      // Include the primary provider first
      results.push({
        provider: primaryConfig.provider,
        model: primaryConfig.model,
      });
    }
  }

  return results;
}

/**
 * Simulate retry logic with exponential backoff.
 * Phase 2.2: This is the blueprint for actual retry implementation.
 *
 * In production, this would:
 * 1. Attempt provider A
 * 2. On rate limit, wait (exponential backoff) and retry provider A
 * 3. On consecutive failures, try provider B
 * 4. Continue until success or all providers exhausted
 */
export async function selectProviderWithFallback(
  role: string,
  config: OrchestratorConfig,
  maxRetries: number = 2
): Promise<ProviderFallbackResult> {
  const attempts: ProviderAttempt[] = [];
  const providers = getFallbackProviders(role, config);

  if (providers.length === 0) {
    return {
      selectedProvider: "unknown",
      selectedModel: "unknown",
      attempts: [
        {
          provider: "unknown",
          model: "unknown",
          status: "unavailable",
          error: `No providers found for role: ${role}`,
        },
      ],
      finalStatus: "all_failed",
    };
  }

  // For Phase 2.2, return the primary provider
  // In Phase 2.3, implement actual retry logic with backoff
  const primary = providers[0]!;

  return {
    selectedProvider: primary.provider,
    selectedModel: primary.model,
    attempts: [
      {
        provider: primary.provider,
        model: primary.model,
        status: "success",
      },
    ],
    finalStatus: "success",
  };
}

/**
 * Calculate backoff delay for retry (Phase 2.2 blueprint).
 * Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
 * Max: 30 seconds between retries.
 */
export function calculateBackoffDelay(attemptNumber: number): number {
  const baseDelayMs = 100;
  const maxDelayMs = 30_000;
  const delay = Math.min(baseDelayMs * Math.pow(2, attemptNumber), maxDelayMs);
  // Add jitter: ±10% of delay
  const jitter = delay * 0.1 * (Math.random() - 0.5);
  return Math.max(0, delay + jitter);
}

/**
 * Format provider fallback result for logging.
 */
export function formatFallbackResult(result: ProviderFallbackResult): string {
  const lines: string[] = [];

  const statusSymbol = result.finalStatus === "success" ? "✅" : "❌";
  lines.push(`${statusSymbol} Provider Selection: ${result.selectedProvider}/${result.selectedModel} (${result.finalStatus})`);

  if (result.attempts.length > 1) {
    lines.push("Fallback chain:");
    for (let i = 0; i < result.attempts.length; i++) {
      const attempt = result.attempts[i]!;
      const symbol = attempt.status === "success" ? "✅" : "❌";
      lines.push(
        `  ${symbol} [${i}] ${attempt.provider}/${attempt.model}: ${attempt.status}`
      );
      if (attempt.error) {
        lines.push(`      Error: ${attempt.error}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Phase 2.2: Select optimal model based on operation type.
 * Strategy: use cheaper models (sonnet) for simple tasks, expensive (opus) for complex.
 */
export function selectOptimalModel(
  baseModel: string,
  operationType: string
): string {
  // Operations that benefit from strong reasoning → use opus
  const complexOperations = [
    "plan_generation",    // Planning is complex
    "discovery",          // Discovery needs deep understanding
    "diagnosis",          // Diagnosis requires analysis
  ];

  // Operations that can use cheaper models → use sonnet
  const simpleOperations = [
    "patch_review",       // Light review
    "strategy_decision",  // Rules-based decision
    "quality_check",      // Lightweight checks
  ];

  // If base model is opus and operation is simple, downgrade to sonnet
  if (baseModel.includes("opus") && simpleOperations.includes(operationType)) {
    return baseModel.replace("opus", "sonnet").replace("4-8", "5");
  }

  // If base model is sonnet and operation is complex, upgrade to opus
  if (baseModel.includes("sonnet") && complexOperations.includes(operationType)) {
    return baseModel.replace("sonnet", "opus").replace("5", "4-8");
  }

  return baseModel;
}
