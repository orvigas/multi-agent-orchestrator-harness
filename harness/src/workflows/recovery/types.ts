export type RootCauseCategory =
  | "Compilation"
  | "Architecture"
  | "Tests"
  | "Runtime"
  | "Dependencies"
  | "Formatting"
  | "Security"
  // Capa 8: el árbol real divergió del snapshot que el sandbox usó al
  // generar el patch. Siempre escala (decideStrategyNode) — reintentar el
  // mismo patch no arregla una divergencia externa.
  | "MergeConflict";

export interface Diagnosis {
  rootCause: RootCauseCategory;
  detail: string;
  confidence: "low" | "medium" | "high";
  isRepeatedFailure: boolean; // ¿ya vimos este MISMO rootCause+detail antes en recoveryHistory?
}

export type Strategy = "retry" | "partial_retry" | "change_context" | "change_model" | "rollback" | "abort";

export interface RecoveryEntry {
  iteration: number;
  diagnosis: Diagnosis;
  strategyChosen: Strategy;
}
