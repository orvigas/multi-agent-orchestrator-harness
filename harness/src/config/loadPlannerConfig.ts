import { createYamlConfigLoader } from "./yamlConfigLoader.js";

export interface PlannerConfig {
  roles: Record<string, { provider: string; model: string }>;
  planning: {
    maxIterations: number;
    discoveryGapThreshold: number;
  };
}

export const loadPlannerConfig = createYamlConfigLoader<PlannerConfig>("config/planner.yml");
