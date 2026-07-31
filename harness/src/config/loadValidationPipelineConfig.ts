import { createYamlConfigLoader } from "./yamlConfigLoader.js";

export interface ValidationPipelineConfig {
  validation: {
    compileCommand: string;
    testCommand: string;
    lintCommand: string;
    staticAnalysisCommand: string;
    securityCommand: string;
    performance: { enabled: boolean; command: string };
    timeouts: {
      compileMs: number;
      testsMs: number;
      lintMs: number;
      staticAnalysisMs: number;
      securityMs: number;
      performanceMs: number;
    };
  };
}

export const loadValidationPipelineConfig = createYamlConfigLoader<ValidationPipelineConfig>(
  "config/validation-pipeline.yml"
);
