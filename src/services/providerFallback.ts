/**
 * Multi-provider fallback for Phase 2.2: cost optimization & resilience.
 * Handles rate limits, retries with backoff, and provider selection.
 */

import type { OrchestratorConfig } from "../config/loadConfig.js";

export interface ProviderAttempt {
  provider: string;
  model: string;
  status: "success" | "rate_limited" | "timeout" | "unavailable" | "error";
  error?: string;
  tokensUsed?: number;
  /** Wall-clock duration of the attempt in ms (Phase 2.5). */
  durationMs?: number;
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
  const err = error as { message?: string; status?: number } | null;
  const msg = err?.message?.toLowerCase() ?? "";

  // Anthropic rate limit errors
  if (msg.includes("rate limit") || msg.includes("429")) return true;
  if (msg.includes("overloaded")) return true;

  // OpenAI rate limit errors
  if (msg.includes("rate_limit_exceeded")) return true;
  if (msg.includes("requests per minute")) return true;

  // Generic HTTP 429
  if (err?.status === 429) return true;

  return false;
}

/**
 * Error thrown when a provider call exceeds its timeout budget (Phase 2.5).
 * Carries the provider/model/budget so the retry loop and logs can be precise.
 */
export class LLMTimeoutError extends Error {
  readonly provider: string;
  readonly model: string;
  readonly timeoutMs: number;

  constructor(provider: string, model: string, timeoutMs: number) {
    super(`Timeout after ${timeoutMs}ms calling ${provider}/${model}`);
    this.name = "LLMTimeoutError";
    this.provider = provider;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Check if an error is a timeout / aborted request (Phase 2.5).
 * Recognizes our own LLMTimeoutError plus the abort errors both SDKs raise
 * when an AbortSignal fires (Anthropic/OpenAI `APIUserAbortError`, DOMException
 * `AbortError`) and plain network timeouts (ETIMEDOUT / ESOCKETTIMEDOUT).
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof LLMTimeoutError) return true;

  const err = error as { name?: string; code?: string; message?: string } | null;
  if (!err) return false;

  if (err.name === "AbortError" || err.name === "APIUserAbortError") return true;
  if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") return true;

  const msg = err.message?.toLowerCase() ?? "";
  return msg.includes("timed out") || msg.includes("timeout") || msg.includes("request was aborted");
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
  _maxRetries: number = 2
): Promise<ProviderFallbackResult> {
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
  // Add jitter: ±10% of delay, but clamp result to [0, maxDelayMs]
  const jitter = delay * 0.1 * (Math.random() - 0.5);
  return Math.max(0, Math.min(delay + jitter, maxDelayMs));
}

/**
 * Phase 2.6: Calculate adaptive backoff based on provider's failure history.
 * Strategy: if a provider is accumulating failures, give it more time to recover.
 *
 * - 0-1 consecutive failures: provider is generally healthy, use quick retry
 * - 2-3 consecutive failures: elevated stress, normal backoff
 * - 4+ consecutive failures: approaching circuit breach, longer backoff to let service breathe
 *
 * Returns a multiplier (1.0 = normal, 2.0 = double time, etc.) to scale the exponential backoff.
 */
/**
 * Phase 2.7: Get timeout budget for a specific role from the orchestrator config.
 * If the role has a per-role timeout defined in its layer's config, use that.
 * Otherwise, fall back to provider-specific timeout (30s Anthropic, 20s OpenAI, etc.).
 *
 * Example: discovery role might have 45s (includes AST search), while
 * plan_validator might have 15s (quick sanity check).
 */
export function getTimeoutForRole(
  role: string,
  config: OrchestratorConfig
): number {
  // Check each layer's config for role-specific timeouts
  const layerConfigs = [
    config as any, // orchestrator itself might have timeouts block
    // Note: individual layer timeouts would be loaded here if we had access
    // For now, this is a placeholder that can be extended when layer configs
    // are passed through the config object
  ];

  // If role-specific timeout found, return it
  // This would be: config.knowledgeEngineConfig?.timeouts?.[role]
  // But those are loaded separately in each layer; for now we return undefined
  // to signal "use provider default"
  return undefined as any;
}

export function calculateAdaptiveBackoffMultiplier(consecutiveFailures: number): number {
  if (consecutiveFailures <= 1) return 1.0;      // Healthy: normal backoff
  if (consecutiveFailures <= 3) return 1.5;      // Stressed: 50% longer
  return 2.5;                                    // Critical: 2.5x longer (give service time)
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
      const symbol =
        attempt.status === "success" ? "✅" : attempt.status === "timeout" ? "⏱️" : "❌";
      const took = attempt.durationMs !== undefined ? ` (${attempt.durationMs}ms)` : "";
      lines.push(
        `  ${symbol} [${i}] ${attempt.provider}/${attempt.model}: ${attempt.status}${took}`
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
