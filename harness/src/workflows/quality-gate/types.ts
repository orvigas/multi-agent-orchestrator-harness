// El how-to (sección 2) declara solo Compilation/Tests/Coverage/Architecture/
// Security/Performance/Documentation/Sonar — pero Capa 5 puede fallar en
// "lint" (Formatting) o "static_analysis" (StaticAnalysis), que no tienen
// dónde caer en esa lista. Se agregan aquí para relayar el failureCategory
// real de Validation Pipeline sin distorsionarlo (nunca forzarlo dentro de
// un dimension que no le corresponde).
export type IssueDimension =
  | "Compilation"
  | "Tests"
  | "Formatting"
  | "StaticAnalysis"
  | "Coverage"
  | "Architecture"
  | "Security"
  | "Performance"
  | "Documentation"
  | "Sonar";

export interface Issue {
  dimension: IssueDimension;
  severity: "advisory" | "blocking";
  evidence: string; // dato objetivo o cita concreta del review — nunca "se ve mal"
  recommendation: string; // qué hacer — el Quality Gate lo sugiere, NUNCA lo aplica
}

export interface CoverageResult {
  beforePct: number;
  afterPct: number;
  thresholdPct: number;
}

export interface SonarResult {
  newCodeSmells: number;
  newDuplicationPct: number;
  qualityGatePassed: boolean;
}

export interface ReviewFinding {
  compliant: boolean;
  findings: string[];
}
