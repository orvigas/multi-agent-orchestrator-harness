import { createYamlConfigLoader } from "./yamlConfigLoader.js";

// Nombrado OrchestratorRuntimeConfig (no OrchestratorConfig) para no chocar
// con el tipo ya existente y muy usado en loadConfig.ts (providers+roles,
// state.config: OrchestratorConfig | null en todo el Orchestrator) — son
// dos conceptos distintos que resultan tener el mismo nombre "obvio".
export interface OrchestratorRuntimeConfig {
  orchestrator: {
    tokenBudget: { limit: number };
    costBudget: { limitUsd: number };
    deadlineMinutes: number;
    runLogPath: string;
  };
}

export const loadOrchestratorConfig = createYamlConfigLoader<OrchestratorRuntimeConfig>("config/orchestrator.yml");
