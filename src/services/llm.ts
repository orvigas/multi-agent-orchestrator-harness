import { Anthropic } from "@anthropic-ai/sdk";
// Phase 2.2: Provider fallback infrastructure
// Actual retry logic will be implemented in Phase 2.3
import type { OrchestratorConfig } from "../config/loadConfig.js";

export const HARNESS_MODE = (process.env.HARNESS_MODE ?? "deterministic") as "deterministic" | "llm";

interface LLMRequest {
  role: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

interface LLMResponse {
  content: string;
  stopReason: "end_turn" | "max_tokens" | "stop_sequence";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  provider: string;           // Phase 2.2: which provider was used
  model: string;              // Phase 2.2: which model was used
}

/**
 * Call an LLM (Anthropic Claude) for a specific role.
 * Records actual token usage (Phase 1.3) for tracking.
 *
 * In deterministic mode, throws error (should be caught by caller with fallback heuristic).
 * In llm mode, calls real Claude API and returns actual token counts.
 */
export async function callLLM(request: LLMRequest, config: OrchestratorConfig): Promise<LLMResponse> {
  // Si estamos en modo determinístico, no debería llamarse
  if (HARNESS_MODE === "deterministic") {
    throw new Error("LLM called in deterministic mode");
  }

  // Resuelve el modelo para el rol
  const roleConfig = config.roles[request.role];
  if (!roleConfig) {
    throw new Error(`No model configured for role: ${request.role}`);
  }

  const provider = config.providers[roleConfig.provider];
  if (!provider) {
    throw new Error(`Provider not found: ${roleConfig.provider}`);
  }

  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`API key not set: ${provider.apiKeyEnv}`);
  }

  // Hoy solo soportamos Anthropic
  if (roleConfig.provider !== "anthropic") {
    throw new Error(`Unsupported provider for ${request.role}: ${roleConfig.provider}`);
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: roleConfig.model,
    max_tokens: request.maxTokens ?? 2000,
    temperature: request.temperature ?? 0.7,
    system: request.systemPrompt,
    messages: [
      {
        role: "user",
        content: request.userPrompt,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in LLM response");
  }

  const totalTokens = response.usage.input_tokens + response.usage.output_tokens;

  // Note: Phase 1.3 token events are recorded by nodes that call callLLM
  // They have access to totalTokens via the LLMResponse and can record events in their state

  return {
    content: textContent.text,
    stopReason: response.stop_reason as "end_turn" | "max_tokens" | "stop_sequence",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens,
    provider: roleConfig.provider,     // Phase 2.2: track which provider
    model: roleConfig.model,            // Phase 2.2: track which model
  };
}
