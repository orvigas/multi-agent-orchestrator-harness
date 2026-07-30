import { createYamlConfigLoader } from "./yamlConfigLoader.js";

export interface QualityGateConfig {
  roles: Record<string, { provider: string; model: string }>;
  qualityGate: {
    coverage: { command: string; maxDropPct: number; blockingDropPct: number };
    sonar: { eslintConfig: string; blockingSmellCount: number; blockingDuplicationPct: number };
  };
}

export const loadQualityGateConfig = createYamlConfigLoader<QualityGateConfig>("config/quality-gate.yml");
