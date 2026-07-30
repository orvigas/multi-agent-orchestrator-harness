import { createYamlConfigLoader } from "./yamlConfigLoader.js";

export interface MergeManagerConfig {
  mergeManager: {
    releaseLogPath: string;
    escalationDir: string;
    dryRun: boolean;
    tagNamingStrategy: string;
  };
}

export const loadMergeManagerConfig = createYamlConfigLoader<MergeManagerConfig>("config/merge-manager.yml");
