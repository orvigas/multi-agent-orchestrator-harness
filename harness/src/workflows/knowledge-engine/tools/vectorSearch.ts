import { buildVectorIndex } from "../indexing/buildIndexes.js";
import { cosineSimilarity, termFreq, tokenize } from "./textUtils.js";
import type { EvidenceItem } from "../types.js";

const SIMILARITY_FLOOR = 0.05;

// Nivel semántico (más caro, difuso): TF-IDF + similitud coseno sobre chunks
// de ~60 líneas, en vez de embeddings reales (no hay proveedor de embeddings
// configurado). Útil cuando el ticket usa lenguaje natural que no calza
// literalmente con nombres de símbolos.
export function vectorSearch(query: string, maxLinesPerItem = 40, topK = 3): EvidenceItem[] {
  const { chunks, idf } = buildVectorIndex();
  const queryTf = termFreq(tokenize(query));

  return chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryTf, chunk.termFreq, idf) }))
    .filter(({ score }) => score > SIMILARITY_FLOOR)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }): EvidenceItem => ({
      id: chunk.id,
      source: "vector",
      content: chunk.text.split("\n").slice(0, maxLinesPerItem).join("\n"),
      relevanceNote: `similitud coseno ${score.toFixed(3)} con la consulta "${query}"`,
    }));
}
