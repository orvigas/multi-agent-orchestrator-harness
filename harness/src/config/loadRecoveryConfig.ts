import { createYamlConfigLoader } from "./yamlConfigLoader.js";

export interface RecoveryConfig {
  roles: Record<string, { provider: string; model: string }>;
  recovery: {
    maxIterations: number;
    fallbackModelsForImplementer: { provider: string; model: string }[];
  };
}

export const loadRecoveryConfig = createYamlConfigLoader<RecoveryConfig>("config/recovery.yml");
