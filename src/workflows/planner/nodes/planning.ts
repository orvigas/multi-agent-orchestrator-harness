import type { PlannerStateType } from "../state.js";
import type { Plan, PlanTask } from "../types.js";

// Stand-in determinista para el rol "planner". Corrige puntualmente lo que
// Validation rechazó en la vuelta anterior (rejectedIssues, rootCause
// "plan_error") en vez de regenerar el plan desde cero — esto es lo que
// hace que el loop revise_plan converja dentro de maxPlanningIterations.
export function planningNode(state: PlannerStateType) {
  const discovery = state.discovery;
  const rejected = state.validationIssues.filter((i) => i.rootCause === "plan_error");
  const forbiddenRejections = rejected.filter((i) => i.rule === "forbidden-zones");
  const riskRejections = rejected.filter((i) => i.rule === "risk-mitigation");

  // riskLevel: la severidad más alta entre los riesgos de Discovery —
  // consumida por la Validation Pipeline (Capa 5) para decidir si vale la
  // pena correr la etapa "performance" (governance §6 de esa capa).
  const risks = discovery?.risks ?? [];
  const riskLevel: PlanTask["riskLevel"] = risks.some((r) => r.severity === "high")
    ? "high"
    : risks.some((r) => r.severity === "medium")
      ? "medium"
      : "low";

  const dependencyFiles = discovery?.dependencies ?? [];
  // language: "typed" en todas las tasks porque este repo es 100% TypeScript
  // — es lo que selectPatternNode (Capa 4) necesita para elegir el patrón
  // "compiler_driven" en vez de caer al fallback "retry".
  const tasks: PlanTask[] = dependencyFiles.map((file, i) => ({
    id: `task-${i + 1}`,
    description: `Actualizar ${file} según "${discovery?.problems[0] ?? "el ticket"}"`,
    // si una vuelta anterior marcó este archivo como zona prohibida, se
    // remueve de touchesFiles en vez de repetir el mismo error.
    touchesFiles: forbiddenRejections.some((r) => r.file === file) ? [] : [file],
    language: "typed",
    riskLevel,
  }));

  const mitigationTasks: PlanTask[] = riskRejections.map((issue, i) => ({
    id: `mitigate-${i + 1}`,
    description: `Mitigar riesgo antes de continuar: ${issue.detail}`,
    touchesFiles: [],
    language: "typed",
    riskLevel,
  }));

  const allTasks = [...mitigationTasks, ...tasks];
  const order = allTasks.map((t) => t.id);
  const dependencies: Record<string, string[]> = {};
  const mitigationIds = mitigationTasks.map((m) => m.id);
  for (const t of tasks) dependencies[t.id] = mitigationIds;
  for (const m of mitigationTasks) dependencies[m.id] = [];

  const plan: Plan = { tasks: allTasks, order, dependencies };
  const iteration = state.planningIteration + 1;

  return {
    plan,
    planningIteration: iteration,
    planRevisions: [{ iteration, plan, rejectedBy: rejected }],
  };
}
