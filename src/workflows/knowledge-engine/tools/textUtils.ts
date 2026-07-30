// Tokenización y TF-IDF mínimos para el tier "vector" (ver vectorSearch.ts y
// indexing/buildIndexes.ts). Sin dependencias externas ni modelo de
// embeddings: esto es una similitud léxica ponderada, no embeddings reales.

const STOPWORDS = new Set([
  "the", "a", "an", "de", "la", "el", "en", "y", "que", "para", "con", "por",
  "un", "una", "los", "las", "del", "se", "es", "su", "sus", "al", "lo", "no",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ_]+/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

export function computeIdf(docs: { termFreq: Map<string, number> }[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const doc of docs) {
    for (const term of doc.termFreq.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  const n = docs.length || 1;
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((n + 1) / (df + 1)) + 1); // smoothed, siempre > 0
  }
  return idf;
}

export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
  idf: Map<string, number>
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const terms = new Set([...a.keys(), ...b.keys()]);
  for (const term of terms) {
    const weight = idf.get(term) ?? 1;
    const wa = (a.get(term) ?? 0) * weight;
    const wb = (b.get(term) ?? 0) * weight;
    dot += wa * wb;
    normA += wa * wa;
    normB += wb * wb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
