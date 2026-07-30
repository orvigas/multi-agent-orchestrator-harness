import { loadQualityGateConfig } from "../../../config/loadQualityGateConfig.js";
import { STAGE_TO_FAILURE_CATEGORY } from "../../validation-pipeline/types.js";
import type { QualityGateStateType } from "../state.js";
import type { Issue } from "../types.js";

// La severidad no es una decisión libre del modelo — está codificada como
// regla (Architecture siempre bloquea si no cumple, Documentation nunca
// bloquea sola, Coverage/Sonar dependen de umbrales de config). Esto
// mantiene auditable y predecible qué detiene un merge y qué no.
export function assembleReportNode(state: QualityGateStateType) {
  const config = loadQualityGateConfig();
  const { coverage, sonar } = config.qualityGate;
  const issues: Issue[] = [];

  // Compilation / Tests / Security / Performance: solo se reportan si YA
  // fallaron en la Capa 5 — nunca se re-evalúan aquí. En la integración real
  // (src/orchestrator/nodes/implementation.ts) el Quality Gate solo se invoca
  // DESPUÉS de que Validation Pipeline dio verdict !== "fail", así que este
  // bucle nunca encuentra un `!passed` en producción — queda por
  // completitud del contrato del subgrafo (y lo ejercitan los tests/demo
  // construyendo el escenario a mano), no porque se espere que dispare en vivo.
  for (const r of state.validationEvidence.filter((result) => !result.passed)) {
    issues.push({
      dimension: STAGE_TO_FAILURE_CATEGORY[r.stage],
      severity: "blocking",
      evidence: r.evidence,
      recommendation: "Ya señalado por Validation Pipeline — no requiere nuevo análisis.",
    });
  }

  if (state.coverageDelta) {
    const covDrop = state.coverageDelta.beforePct - state.coverageDelta.afterPct;
    if (covDrop > coverage.maxDropPct) {
      issues.push({
        dimension: "Coverage",
        severity: covDrop > coverage.blockingDropPct ? "blocking" : "advisory",
        evidence: `Cobertura bajó ${covDrop.toFixed(1)}pp (${state.coverageDelta.beforePct}% → ${state.coverageDelta.afterPct}%)`,
        recommendation: "Agregar tests para las líneas nuevas sin cobertura.",
      });
    }
  }

  if (state.sonarResult && !state.sonarResult.qualityGatePassed) {
    const overSmells = state.sonarResult.newCodeSmells > sonar.blockingSmellCount;
    const overDuplication = state.sonarResult.newDuplicationPct > sonar.blockingDuplicationPct;
    issues.push({
      dimension: "Sonar",
      severity: overSmells || overDuplication ? "blocking" : "advisory",
      evidence: `${state.sonarResult.newCodeSmells} code smells nuevos, ${state.sonarResult.newDuplicationPct}% duplicación`,
      recommendation: "Revisar hotspots reportados antes de acumular deuda técnica.",
    });
  }

  if (state.architectureReview && !state.architectureReview.compliant) {
    issues.push({
      dimension: "Architecture",
      severity: "blocking", // desalineación arquitectónica siempre bloquea, nunca es solo advisory
      evidence: state.architectureReview.findings.join("; "),
      recommendation: "Revisar contra el patrón/ADR citado antes de mergear.",
    });
  }

  if (state.documentationReview && !state.documentationReview.compliant) {
    issues.push({
      dimension: "Documentation",
      severity: "advisory", // documentación faltante nunca bloquea el merge por sí sola
      evidence: state.documentationReview.findings.join("; "),
      recommendation: "Actualizar CLAUDE.md/architecture antes del próximo ciclo, no bloquea este merge.",
    });
  }

  const verdict = issues.some((i) => i.severity === "blocking")
    ? "blocking"
    : issues.length > 0
      ? "advisory_only"
      : "clear";

  return { issues, verdict } as const;
}
