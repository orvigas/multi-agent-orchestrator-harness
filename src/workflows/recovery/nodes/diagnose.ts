import { extractForbiddenPatterns, matchesForbiddenPattern } from "../../../config/forbiddenZones.js";
import { buildContextBlock } from "../../../config/loadContext.js";
import type { RecoveryStateType } from "../state.js";
import type { Diagnosis, RootCauseCategory } from "../types.js";
import type { FailureCategory } from "../../validation-pipeline/types.js";
import type { IssueDimension } from "../../quality-gate/types.js";

// Capa 7 (Quality Gate) tiene su propia taxonomía (IssueDimension), no
// FailureCategory — se usa SOLO cuando compile/tests ya pasaron en la Capa 5
// (failureCategory es null) y el problema lo encontró el Quality Gate.
// Coverage/Sonar no tienen rootCause propio: Coverage es una preocupación de
// exhaustividad de tests, Sonar de deuda estructural. Documentation nunca
// llega acá (nunca bloquea), pero se mapea igual por completitud de tipos.
const QUALITY_GATE_ROOT_CAUSE: Record<IssueDimension, RootCauseCategory> = {
  Compilation: "Compilation",
  Tests: "Tests",
  Formatting: "Formatting",
  StaticAnalysis: "Architecture",
  Coverage: "Tests",
  Architecture: "Architecture",
  Security: "Security",
  Performance: "Runtime",
  Sonar: "Architecture",
  Documentation: "Formatting",
};

// Capa 5 decide objetivamente qué falló (failureCategory); este mapeo base
// solo lo traduce a la taxonomía más rica de causa raíz que ya usaba el
// diseño original. Performance/StaticAnalysis no tienen categoría propia en
// esa taxonomía — Performance se manifiesta en runtime, y nuestra etapa
// static_analysis (una segunda pasada de tsc más estricta) apunta más a
// problemas estructurales que a un error de compilación plano.
const BASE_ROOT_CAUSE: Record<FailureCategory, RootCauseCategory> = {
  Compilation: "Compilation",
  Tests: "Tests",
  Formatting: "Formatting",
  Security: "Security",
  StaticAnalysis: "Architecture",
  Performance: "Runtime",
};

// Stand-in determinista para el rol "recovery_diagnostician": profundiza la
// causa raíz con UNA reclasificación real basada en evidencia (no inventada):
// si un fallo de "Compilation" menciona en su evidencia cruda una ruta
// prohibida real (.harness/rules/forbidden-zones.md), la causa raíz real es
// "Architecture" (la task intentó cruzar una frontera prohibida), no un
// simple error de compilación — el ejemplo exacto del how-to.
function reclassify(failureCategory: FailureCategory, evidence: string[]): RootCauseCategory {
  const base = BASE_ROOT_CAUSE[failureCategory];
  if (base !== "Compilation") return base;

  const forbiddenPatterns = extractForbiddenPatterns(buildContextBlock("rules"));
  const mentionsForbiddenPath = evidence.some((text) =>
    forbiddenPatterns.some((pattern) => matchesForbiddenPattern(text, pattern))
  );
  return mentionsForbiddenPath ? "Architecture" : base;
}

export function diagnoseNode(state: RecoveryStateType): { diagnosis: Diagnosis } {
  let rootCause: RootCauseCategory;
  let detail: string;
  let confidence: Diagnosis["confidence"];

  if (state.mergeConflict) {
    // Capa 8: llegó hasta acá con compile/tests/quality gate ya en verde —
    // el problema es que el árbol real divergió del snapshot del sandbox al
    // momento de promover. Chequeada primero: es independiente de
    // failureCategory/qualityGateIssues (ambos vendrían null/vacíos en este
    // camino de todos modos, ya que Merge Manager solo corre después de que
    // los dos pasaron).
    rootCause = "MergeConflict";
    detail = `Conflicto de merge en: ${state.mergeConflict.files.join(", ")}`.slice(0, 300);
    confidence = "high";
  } else if (state.failureCategory) {
    // Camino normal: compile/tests/lint/etc. falló en la Capa 5.
    const evidenceTexts = state.validationEvidence.map((r) => r.evidence);
    rootCause = reclassify(state.failureCategory, evidenceTexts);
    const failedStage = state.validationEvidence.find((r) => !r.passed);
    detail = failedStage
      ? `${failedStage.stage}: ${failedStage.evidence.split("\n")[0]}`.slice(0, 300)
      : `${state.failureCategory}: sin evidencia detallada disponible`;
    confidence = failedStage ? "high" : "low";
  } else if (state.qualityGateIssues.length > 0) {
    // compile/tests ya pasaron (failureCategory null) — el Quality Gate
    // (Capa 7) es quien encontró el problema; se usa el primer issue
    // blocking (o el primero a secas si por algún motivo ninguno lo es).
    const blocking = state.qualityGateIssues.find((i) => i.severity === "blocking") ?? state.qualityGateIssues[0];
    rootCause = QUALITY_GATE_ROOT_CAUSE[blocking.dimension];
    detail = `${blocking.dimension}: ${blocking.evidence.split("\n")[0]}`.slice(0, 300);
    confidence = "high";
  } else {
    rootCause = "Tests";
    detail = "sin evidencia detallada disponible";
    confidence = "low";
  }

  const isRepeatedFailure = state.recoveryHistory.some(
    (h) => h.diagnosis.rootCause === rootCause && h.diagnosis.detail === detail
  );

  return { diagnosis: { rootCause, detail, confidence, isRepeatedFailure } };
}
