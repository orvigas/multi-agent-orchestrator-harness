import { createYamlConfigLoader } from "./yamlConfigLoader.js";

export interface ImplementationConfig {
  roles: Record<string, { provider: string; model: string }>;
  implementation: {
    maxIterationsPerTask: number;
    sandbox: {
      mode: string;
      cleanupOnEscalate: boolean;
    };
  };
}

export const loadImplementationConfig = createYamlConfigLoader<ImplementationConfig>("config/implementation.yml");
