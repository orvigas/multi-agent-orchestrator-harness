import { callLLM, HARNESS_MODE } from "../../../services/llm.js";
import { buildContextBlock } from "../../../config/loadContext.js";
import type { PlannerStateType } from "../state.js";
import type { Plan, PlanTask } from "../types.js";

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
      const rejectedContext = rejected.length > 0
        ? `Previous rejections that need to be fixed:\n${rejected.map((r) => `- ${r.rule}: ${r.detail} (${r.file})`).join("\n")}`
        : "";

      const userPrompt = `
Problems to solve:
${discovery?.problems.map((p) => `- ${p}`).join("\n")}

Dependencies identified:
${discovery?.dependencies.map((d) => `- ${d}`).join("\n")}

Risks:
${risks.map((r) => `- [${r.severity}] ${r.description}`).join("\n")}

${rejectedContext}

Generate a JSON plan with:
{
  "tasks": [
    {
      "id": "task-N",
      "description": "what to do",
      "touchesFiles": ["file1.ts", "file2.ts"],
      "language": "typed",
      "riskLevel": "high|medium|low"
    }
  ],
  "order": ["task-1", "task-2", ...]
}

Return ONLY the JSON, no other text.
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

      const result = JSON.parse(response.content);
      const tasks: PlanTask[] = (result.tasks || []).map((t: any) => ({
        id: t.id,
        description: t.description,
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
