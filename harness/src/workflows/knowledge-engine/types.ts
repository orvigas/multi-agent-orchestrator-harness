export interface EvidenceItem {
  id: string; // path#symbol o path#lineRange
  source: "ast" | "grep" | "vector" | "adr" | "rule";
  content: string;
  relevanceNote: string; // por qué se aceptó (o por qué se descartó)
}

export interface RetrievalAction {
  tier: "ast" | "grep" | "vector";
  query: string;
}
