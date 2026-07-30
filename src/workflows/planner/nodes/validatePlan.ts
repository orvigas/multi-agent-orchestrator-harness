import { buildContextBlock } from "../../../config/loadContext.js";
import { extractForbiddenPatterns, matchesForbiddenPattern } from "../../../config/forbiddenZones.js";
import { tokenize } from "../../knowledge-engine/tools/textUtils.js";
import { routeAfterValidation } from "./routing.js";
import type { PlannerStateType } from "../state.js";
import type { ValidationIssue } from "../types.js";

function isRiskMitigated(riskDescription: string, taskDescriptions: string[]): boolean {
  const riskTerms = new Set(tokenize(riskDescription));
  return taskDescriptions.some((desc) => tokenize(desc).some((term) => riskTerms.has(term)));
}

// Stand-in determinista para el rol "plan_validator", independiente del
// planner: nunca modifica el plan, solo lo evalúa contra reglas reales.
export function validatePlanNode(state: PlannerStateType) {
  const plan = state.plan;
  const issues: ValidationIssue[] = [];

  if (!plan) {
    issues.push({ rule: "missing-plan", detail: "No hay plan que validar.", rootCause: "plan_error" });
  } else {
    const forbiddenPatterns = extractForbiddenPatterns(buildContextBlock("rules"));
    for (const task of plan.tasks) {
      for (const file of task.touchesFiles) {
        const hit = forbiddenPatterns.find((p) => matchesForbiddenPattern(file, p));
        if (hit) {
          issues.push({
            rule: "forbidden-zones",
            detail: `Task ${task.id} toca "${file}", prohibido por patrón "${hit}".`,
            rootCause: "plan_error",
            file,
          });
        }
      }
    }

    const highRisks = state.discovery?.risks.filter((r) => r.severity === "high") ?? [];
    const taskDescriptions = plan.tasks.map((t) => t.description);
    for (const risk of highRisks) {
      if (!isRiskMitigated(risk.description, taskDescriptions)) {
        issues.push({ rule: "risk-mitigation", detail: risk.description, rootCause: "plan_error" });
      }
    }

    const hasNoDependencies = (state.discovery?.dependencies.length ?? 0) === 0;
    const hasNoRisks = (state.discovery?.risks.length ?? 0) === 0;
    if (hasNoDependencies && hasNoRisks) {
      issues.push({
        rule: "discovery-completeness",
        detail: "Discovery no identificó dependencias ni riesgos.",
        rootCause: "discovery_gap",
      });
    }
  }

  const validationVerdict: "valid" | "invalid" = issues.length === 0 ? "valid" : "invalid";
  // Reusa el propio router para dejar constancia de la decisión resultante
  // en `strategy` (el how-to declara el campo pero nunca lo escribe, ya que
  // una conditional edge solo enruta, no persiste estado).
  const strategy = routeAfterValidation({ ...state, validationVerdict, validationIssues: issues });

  return { validationVerdict, validationIssues: issues, strategy };
}
