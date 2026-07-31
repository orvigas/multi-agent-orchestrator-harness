import { callLLM, HARNESS_MODE } from "../../../services/llm.js";
import { buildContextBlock } from "../../../config/loadContext.js";
import type { PlannerStateType } from "../state.js";
import type { Plan, PlanTask, ValidationIssue } from "../types.js";

// Estructura las rejecciones por severidad y patrón
function structureRejectedContext(rejected: ValidationIssue[]): string {
  if (rejected.length === 0) return "";

  const forbidden = rejected.filter((r) => r.rule === "forbidden-zones");
  const risks = rejected.filter((r) => r.rule === "risk-mitigation");

  let output = "## REJECTION ANALYSIS (from previous attempt):\n\n";

  if (forbidden.length > 0) {
    output += "### ❌ CRITICAL: Forbidden Zones (CANNOT be modified)\n";
    const files = [...new Set(forbidden.map((r) => r.file))];
    for (const file of files) {
      const count = forbidden.filter((r) => r.file === file).length;
      output += `  - ${file} (rejected ${count}x)\n`;
    }
    output += "  → Do NOT include these files in touchesFiles. Plan around them.\n\n";
  }

  if (risks.length > 0) {
    output += "### ⚠️  WARNINGS: Risk Mitigation Needed\n";
    for (const risk of risks) {
      output += `  - ${risk.file}: ${risk.detail}\n`;
    }
    output += "  → Add mitigation tasks or safety measures.\n\n";
  }

  return output;
}

// Stand-in determinista para el rol "planner". Corrige puntualmente lo que
// Validation rechazó en la vuelta anterior (rejectedIssues, rootCause
// "plan_error") en vez de regenerar el plan desde cero — esto es lo que
// hace que el loop revise_plan converja dentro de maxPlanningIterations.
export async function planningNode(state: PlannerStateType) {
  const discovery = state.discovery;
  const rejected = state.validationIssues.filter((i) => i.rootCause === "plan_error");
  const forbiddenRejections = rejected.filter((i) => i.rule === "forbidden-zones");
  const riskRejections = rejected.filter((i) => i.rule === "risk-mitigation");

  const risks = discovery?.risks ?? [];
  const riskLevel: PlanTask["riskLevel"] = risks.some((r) => r.severity === "high")
    ? "high"
    : risks.some((r) => r.severity === "medium")
      ? "medium"
      : "low";

  // Modo LLM: pedir a Claude que genere el plan
  if (HARNESS_MODE === "llm" && state.config) {
    try {
      const rejectedContext = structureRejectedContext(rejected);

      const userPrompt = `
Problems to solve:
${discovery?.problems.map((p) => `- ${p}`).join("\n")}

Dependencies identified:
${discovery?.dependencies.map((d) => `- ${d}`).join("\n")}

Risks:
${risks.map((r) => `- [${r.severity}] ${r.description}`).join("\n")}

${rejectedContext}

Generate a detailed execution plan. CRITICAL REQUIREMENTS:
- Each task MUST have a unique id (use "task-1", "task-2", etc.)
- touchesFiles MUST be absolute paths (e.g., "src/services/Auth.ts")
- order MUST list EVERY task id, in execution sequence (no duplicates, no missing ids)
- riskLevel MUST be exactly "high", "medium", or "low"
- Respect previous rejections: do NOT repeat forbidden zones

Example valid plan:
{
  "tasks": [
    {"id": "task-1", "description": "Update Auth.ts validate method", "touchesFiles": ["src/services/Auth.ts"], "language": "typed", "riskLevel": "medium"},
    {"id": "task-2", "description": "Add unit tests for validate", "touchesFiles": ["src/services/Auth.test.ts"], "language": "typed", "riskLevel": "low"}
  ],
  "order": ["task-1", "task-2"]
}

Return ONLY valid JSON, no markdown or explanation.
`;

      const response = await callLLM(
        {
          role: "planner",
          systemPrompt: buildContextBlock("architecture", state.targetPath),
          userPrompt,
          temperature: 0.5,
          maxTokens: 2000,
        },
        state.config
      );

      // El JSON viene de un LLM: cada campo puede faltar, así que se aplican
      // defaults en vez de confiar en la forma (antes esto era un `any` y un
      // task sin `id` se colaba como `undefined` hasta el Orchestrator).
      const result = JSON.parse(response.content) as {
        tasks?: Array<Partial<PlanTask>>;
        order?: string[];
      };
      const tasks: PlanTask[] = (result.tasks || []).map((t, i) => ({
        id: t.id ?? `task-${i + 1}`,
        description: t.description ?? "(sin descripción)",
        // Respeta restricciones: si fue marcado forbidden-zone antes, vacía touchesFiles
        touchesFiles: forbiddenRejections.some((r) => r.file && t.touchesFiles?.includes(r.file))
          ? []
          : t.touchesFiles || [],
        language: t.language || "typed",
        riskLevel: t.riskLevel || riskLevel,
      }));

      const mitigationTasks: PlanTask[] = riskRejections.map((issue, i) => ({
        id: `mitigate-${i + 1}`,
        description: `Mitigar riesgo antes de continuar: ${issue.detail}`,
        touchesFiles: [],
        language: "typed",
        riskLevel,
      }));

      const allTasks = [...mitigationTasks, ...tasks];
      const order = result.order || allTasks.map((t) => t.id);
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
    } catch (err) {
      // Fallback a heurística si LLM falla
      console.error("LLM planning failed:", err);
    }
  }

  // Modo determinístico o fallback: usar heurística
  const dependencyFiles = discovery?.dependencies ?? [];
  const tasks: PlanTask[] = dependencyFiles.map((file, i) => ({
    id: `task-${i + 1}`,
    description: `Actualizar ${file} según "${discovery?.problems[0] ?? "el ticket"}"`,
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
