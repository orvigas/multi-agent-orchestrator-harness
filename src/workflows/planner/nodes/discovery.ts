import { callLLM, HARNESS_MODE } from "../../../services/llm.js";
import { buildContextBlock } from "../../../config/loadContext.js";
import { loadPlannerConfig } from "../../../config/loadPlannerConfig.js";
import type { PlannerStateType } from "../state.js";
import type { DiscoveryResult } from "../types.js";

const DESTRUCTIVE_CHANGE_PATTERN = /elimina|borra|remov|delet/i;

// Stand-in determinista para el rol "discovery". Por instrucción explícita
// del how-to ("analiza el ticket usando SOLO la evidencia entregada"), esto
// razona únicamente sobre `state.evidence` (el evidence package de la Capa 2,
// que ya incluye .harness/rules + ADRs como items source:"rule"/"adr") — no
// hace una llamada aparte a buildContextBlock("architecture") como el
// snippet original, para no releer lo que la evidencia ya trae.
export async function discoveryNode(state: PlannerStateType) {
  const config = loadPlannerConfig();
  const ticket = state.ticket;
  if (!ticket) {
    return {
      discovery: { problems: [], dependencies: [], risks: [] },
      maxPlanningIterations: config.planning.maxIterations,
      discoveryGapThreshold: config.planning.discoveryGapThreshold,
    };
  }

  // Modo LLM: pedir a Claude que analice el ticket y evidencia
  if (HARNESS_MODE === "llm" && state.config) {
    try {
      const evidenceBlock = state.evidence
        .map((e) => `[${e.source}] ${e.id}: ${e.relevanceNote}\n${e.content}`)
        .join("\n\n---\n\n");

      const userPrompt = `
Ticket: ${ticket.title}
Description: ${ticket.description}

Evidence from Knowledge Engine:
${evidenceBlock || "(sin evidencia)"}

You are an expert code analyst. Analyze this ticket and evidence to identify:
1. Main problems this ticket aims to solve
2. Files that MUST be modified (absolute paths from repo root)
3. Risks or concerns

CRITICAL REQUIREMENTS:
- dependencies: MUST be absolute file paths (e.g., "src/services/Auth.ts", NOT "Auth" or "Auth.ts")
- risks: severity MUST be exactly "high", "medium", or "low"
- problems: focus on THE PROBLEM, not the solution
- Return ONLY valid JSON, no markdown or extra text

Return this JSON structure:
{
  "problems": ["problem statement 1", "problem statement 2"],
  "dependencies": ["src/path/to/file1.ts", "src/path/to/file2.ts"],
  "risks": [
    {"description": "what could go wrong", "severity": "high|medium|low"}
  ]
}
`;

      const response = await callLLM(
        {
          role: "discovery",
          systemPrompt: buildContextBlock("architecture", state.targetPath),
          userPrompt,
          temperature: 0.7,
          maxTokens: 1500,
        },
        state.config
      );

      const result = JSON.parse(response.content);
      const discovery: DiscoveryResult = {
        problems: result.problems || [ticket.title],
        dependencies: result.dependencies || [],
        risks: result.risks || [],
      };

      return {
        discovery,
        maxPlanningIterations: config.planning.maxIterations,
        discoveryGapThreshold: config.planning.discoveryGapThreshold,
      };
    } catch (err) {
      // Fallback a heurística si LLM falla
      console.error("LLM discovery failed:", err);
    }
  }

  // Modo determinístico o fallback: usar heurística
  const text = `${ticket.title} ${ticket.description}`;

  const problems = [ticket.title];

  const dependencies = [
    ...new Set(
      state.evidence
        .filter((e) => e.source === "ast" || e.source === "grep" || e.source === "vector")
        .map((e) => e.id.split("#")[0])
    ),
  ];

  const risks: DiscoveryResult["risks"] = [];
  if (state.evidence.length === 0) {
    risks.push({
      description: "Evidencia insuficiente del Knowledge Engine para este ticket.",
      severity: "high",
    });
  }
  if (DESTRUCTIVE_CHANGE_PATTERN.test(text)) {
    risks.push({
      description: "Cambio destructivo: elimina o remueve código/símbolos existentes.",
      severity: "high",
    });
  }

  const previousGaps = state.validationIssues.filter((i) => i.rootCause === "discovery_gap");
  for (const gap of previousGaps) {
    risks.push({ description: `Gap de entendimiento corregido: ${gap.detail}`, severity: "medium" });
  }

  const discovery: DiscoveryResult = { problems, dependencies, risks };

  return {
    discovery,
    maxPlanningIterations: config.planning.maxIterations,
    discoveryGapThreshold: config.planning.discoveryGapThreshold,
  };
}
