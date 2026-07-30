import { Anthropic } from "@anthropic-ai/sdk";
import { OpenAI } from "openai";
import {
  isRateLimitError,
  getFallbackProviders,
  calculateBackoffDelay,
  formatFallbackResult,
} from "./providerFallback.js";
import type { OrchestratorConfig } from "../config/loadConfig.js";
import type { ProviderAttempt } from "./providerFallback.js";

export const HARNESS_MODE = (process.env.HARNESS_MODE ?? "deterministic") as "deterministic" | "llm";

export interface LLMRequest {
  role: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  stopReason: "end_turn" | "max_tokens" | "stop_sequence";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  provider: string;           // Phase 2.2: which provider was used
  model: string;              // Phase 2.2: which model was used
  attempts?: ProviderAttempt[]; // Phase 2.3: retry history
}

// Provider-specific timeouts (Phase 2.3)
const PROVIDER_TIMEOUTS_MS: Record<string, number> = {
  anthropic: 30_000,   // 30s (often slower due to capacity)
  openai: 20_000,      // 20s
  openrouter: 60_000,  // 60s (proxy, add extra buffer)
};

function getTimeoutForProvider(provider: string): number {
  return PROVIDER_TIMEOUTS_MS[provider] ?? 30_000;
}

// Sleep helper for backoff (Phase 2.3)
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call a specific provider (Phase 2.3: provider abstraction).
 * Handles Anthropic and OpenAI.
 * Note: timeoutMs is reserved for Phase 2.4 when adding actual timeout enforcement.
 */
async function callProvider(
  provider: string,
  model: string,
  request: LLMRequest,
  apiKey: string,
  _timeoutMs: number
): Promise<LLMResponse> {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: request.maxTokens ?? 2000,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in LLM response");
    }

    const totalTokens = response.usage.input_tokens + response.usage.output_tokens;
    return {
      content: textContent.text,
      stopReason: response.stop_reason as "end_turn" | "max_tokens" | "stop_sequence",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens,
      provider,
      model,
    };
  } else if (provider === "openai") {
    const client = new OpenAI({ apiKey });
    const response = await (client.chat.completions.create as (
      params: unknown
    ) => Promise<unknown>)({
      model,
      max_tokens: request.maxTokens ?? 2000,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    });

    const responseObj = response as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const textContent = responseObj.choices?.[0]?.message?.content;
    if (!textContent) {
      throw new Error("No text content in LLM response");
    }

    const totalTokens =
      (responseObj.usage?.prompt_tokens ?? 0) + (responseObj.usage?.completion_tokens ?? 0);
    return {
      content: textContent,
      stopReason: responseObj.choices?.[0]?.finish_reason === "stop" ? "end_turn" : "max_tokens",
      inputTokens: responseObj.usage?.prompt_tokens ?? 0,
      outputTokens: responseObj.usage?.completion_tokens ?? 0,
      totalTokens,
      provider,
      model,
    };
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Call an LLM with retry + fallback (Phase 2.3).
 * Features:
 * - Retry on rate limit (exponential backoff)
 * - Fallback to alternative providers
 * - Provider-specific timeouts
 * - Records all attempts for observability
 */
export async function callLLM(request: LLMRequest, config: OrchestratorConfig): Promise<LLMResponse> {
  if (HARNESS_MODE === "deterministic") {
    throw new Error("LLM called in deterministic mode");
  }

  // Get fallback provider chain
  const providers = getFallbackProviders(request.role, config);
  if (providers.length === 0) {
    throw new Error(`No providers found for role: ${request.role}`);
  }

  const attempts: ProviderAttempt[] = [];
  let lastError: Error | null = null;

  // Try each provider with retries
  for (const { provider: providerName, model } of providers) {
    const providerConfig = config.providers[providerName];
    if (!providerConfig) {
      attempts.push({
        provider: providerName,
        model,
        status: "unavailable",
        error: `Provider not configured: ${providerName}`,
      });
      continue;
    }

    const apiKey = process.env[providerConfig.apiKeyEnv];
    if (!apiKey) {
      attempts.push({
        provider: providerName,
        model,
        status: "unavailable",
        error: `API key not set: ${providerConfig.apiKeyEnv}`,
      });
      continue;
    }

    const timeout = getTimeoutForProvider(providerName);
    const maxAttemptsPerProvider = 2; // Retry once on rate limit

    // Retry loop per provider (Phase 2.3)
    for (let attemptNum = 0; attemptNum < maxAttemptsPerProvider; attemptNum++) {
      try {
        const response = await callProvider(providerName, model, request, apiKey, timeout);

        attempts.push({
          provider: providerName,
          model,
          status: "success",
          tokensUsed: response.totalTokens,
        });

        // Success! Return with attempt history
        return {
          ...response,
          attempts,
        };
      } catch (error) {
        const errorMsg = (error as Error).message;
        lastError = error as Error;

        // Check if rate limited
        if (isRateLimitError(error)) {
          const backoffMs = calculateBackoffDelay(attemptNum);
          console.warn(
            `Rate limited on ${providerName}/${model}. Waiting ${backoffMs}ms before retry...`
          );
          attempts.push({
            provider: providerName,
            model,
            status: "rate_limited",
            error: errorMsg,
          });

          if (attemptNum < maxAttemptsPerProvider - 1) {
            // Retry this provider after backoff
            await sleep(backoffMs);
            continue;
          }
        } else {
          // Other error (auth, unavailable, etc.)
          attempts.push({
            provider: providerName,
            model,
            status: "error",
            error: errorMsg,
          });
        }

        // Move to next provider
        break;
      }
    }
  }

  // All providers exhausted
  console.error(`All providers exhausted for role: ${request.role}`);
  console.error(formatFallbackResult({
    selectedProvider: "none",
    selectedModel: "none",
    attempts,
    finalStatus: "all_failed",
  }));

  throw lastError ?? new Error(`No providers available for role: ${request.role}`);
}
