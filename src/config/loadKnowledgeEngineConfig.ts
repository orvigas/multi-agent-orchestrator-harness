import { createYamlConfigLoader } from "./yamlConfigLoader.js";

export interface KnowledgeEngineConfig {
  indexing: {
    structural: { parser: string; storage: string; reindexOn: string };
    vector: { embeddingModel: string; store: string; chunking: string; maxChunkLines: number };
  };
  retrieval: {
    maxIterations: number;
    maxEvidenceItems: number;
    maxLinesPerItem: number;
  };
  roles: Record<string, { provider: string; model: string }>;
}

export const loadKnowledgeEngineConfig = createYamlConfigLoader<KnowledgeEngineConfig>("config/knowledge-engine.yml");
