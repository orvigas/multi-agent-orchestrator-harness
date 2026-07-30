export type Stage = "compile" | "tests" | "lint" | "static_analysis" | "security" | "performance";

export interface StageResult {
  stage: Stage;
  passed: boolean;
  durationMs: number;
  evidence: string; // salida cruda de la herramienta, truncada, NUNCA interpretada
  exitCode: number;
}

// Misma taxonomía que va a consumir el Recovery Loop (Capa 6) para
// diagnosticar — definida aquí para no inventar otra en la siguiente guía.
export type FailureCategory = "Compilation" | "Tests" | "Formatting" | "Security" | "Performance" | "StaticAnalysis";

// Único lugar donde vive este mapeo — tanto assembleVerdictNode (Capa 5)
// como assembleReportNode (Capa 7, que relaya fallos ya vistos por Capa 5)
// lo necesitan idéntico; antes estaba duplicado en los dos archivos.
export const STAGE_TO_FAILURE_CATEGORY: Record<Stage, FailureCategory> = {
  compile: "Compilation",
  tests: "Tests",
  lint: "Formatting",
  static_analysis: "StaticAnalysis",
  security: "Security",
  performance: "Performance",
};
