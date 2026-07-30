import path from "node:path";
import { loadStaticContext as loadStaticContextIndex } from "../indexing/buildIndexes.js";
import { loadKnowledgeEngineConfig } from "../../../config/loadKnowledgeEngineConfig.js";
import type { KnowledgeStateType } from "../state.js";
import type { EvidenceItem } from "../types.js";

// Siempre el primer nodo del loop: carga .harness/rules + .harness/architecture
// (incl. ADRs) como evidencia ya confirmada (no se busca con AI, se carga
// completa porque es pequeña y estable), y los límites de gobernanza propios
// del Knowledge Engine desde config/knowledge-engine.yml.
export function loadStaticContextNode(_state: KnowledgeStateType) {
  const layers = loadStaticContextIndex();
  const config = loadKnowledgeEngineConfig();

  const confirmedEvidence: EvidenceItem[] = layers.map((layer) => {
    const relPath = path.relative(process.cwd(), layer.file);
    const isAdr = relPath.includes(`${path.sep}adr${path.sep}`);
    return {
      id: relPath,
      source: isAdr ? "adr" : "rule",
      content: layer.content.split("\n").slice(0, config.retrieval.maxLinesPerItem).join("\n"),
      relevanceNote: `contexto estático (.harness/${layer.source}) cargado siempre, sin búsqueda`,
    };
  });

  return {
    confirmedEvidence,
    maxIterations: config.retrieval.maxIterations,
    retrievalConfig: {
      maxEvidenceItems: config.retrieval.maxEvidenceItems,
      maxLinesPerItem: config.retrieval.maxLinesPerItem,
    },
  };
}
