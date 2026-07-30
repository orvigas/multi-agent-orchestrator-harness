import { implementationWorkflow } from "../../workflows/implementation/graph.js";
import { cleanupSandbox } from "../../workflows/implementation/tools/sandbox.js";
import { validationPipelineWorkflow } from "../../workflows/validation-pipeline/graph.js";
import { qualityGateWorkflow } from "../../workflows/quality-gate/graph.js";
import { mergeManagerWorkflow } from "../../workflows/merge-manager/graph.js";
import { appendReleaseLogEntry } from "../../workflows/merge-manager/releaseLog.js";
import { loadMergeManagerConfig } from "../../config/loadMergeManagerConfig.js";
import { decisionEntry } from "../decisionLog.js";
import type { OrchestratorStateType } from "../state.js";
import type { Plan, PlanTask } from "../../workflows/planner/types.js";
import type { FailureCategory, StageResult } from "../../workflows/validation-pipeline/types.js";
import type { Issue } from "../../workflows/quality-gate/types.js";
import type { ConflictReport } from "../../workflows/merge-manager/types.js";
import type { Ticket } from "../types.js";

// Pura y testeable por separado (ver implementation.test.ts): decide en qué
// orden correr las tasks del plan y con cuál sustituir la que falló. Si
// failedTaskId es null, corre el plan completo desde el principio. Si no,
// retoma en esa posición — las tasks anteriores ya pasaron — y si hay un
// targetedFixTask, SOLO esa primera posición se sustituye; el resto del
// plan.order sigue intacto. Nunca se usa el id del fix task como punto de
// reanudación: failedTaskId siempre apunta al id ORIGINAL del plan, así que
// un segundo fallo de la misma task se sigue resolviendo a la posición
// correcta.
export function resolveExecutionPlan(
  plan: Plan,
  failedTaskId: string | null,
  targetedFixTask: PlanTask | null
): { taskId: string; task: PlanTask }[] {
  const taskById = new Map(plan.tasks.map((t) => [t.id, t]));
  const startIndex = failedTaskId ? Math.max(plan.order.indexOf(failedTaskId), 0) : 0;

  return plan.order
    .slice(startIndex)
    .map((taskId, i) => {
      const isResumedTask = i === 0 && failedTaskId === taskId;
      const task = isResumedTask && targetedFixTask ? targetedFixTask : taskById.get(taskId);
      return task ? { taskId, task } : null;
    })
    .filter((entry): entry is { taskId: string; task: PlanTask } => entry !== null);
}

// Real, mínimo (referenciado como `toFollowUpTickets` en el how-to de la
// Capa 7, nunca definido): una task de seguimiento de baja prioridad por
// cada issue advisory, para que un humano (o un ciclo futuro) la revise sin
// bloquear el ticket actual. origin:"quality_gate" para que implementationNode
// no vuelva a generar seguimiento a partir de un ticket que ya es seguimiento.
// El id incluye taskId porque esta función se llama una vez POR TASK dentro
// del loop de implementationNode — sin taskId, "i" reinicia en cada llamada
// y dos tasks del mismo plan con el mismo issue producirían ids duplicados.
export function toFollowUpTickets(ticketId: string, taskId: string, issues: Issue[]): Ticket[] {
  return issues
    .filter((issue) => issue.severity === "advisory")
    .map((issue, i) => ({
      id: `${ticketId}-${taskId}-followup-${issue.dimension.toLowerCase()}-${i + 1}`,
      title: `[Quality Gate] ${issue.dimension}: ${issue.recommendation}`,
      description: issue.evidence,
      status: "pending" as const,
      origin: "quality_gate" as const,
    }));
}

const SIMULATED_TOKENS_PER_TASK = 500;
const SIMULATED_COST_USD_PER_TASK = 0.02;

function failFast(message: string) {
  return {
    lastImplementationResult: "fail" as const,
    decisionLog: [decisionEntry("implementation", message)],
  };
}

// Cuando el Implementation Loop escala SIN llegar a la Validation Pipeline
// (quick-check nunca dio "ready"), Recovery igual necesita un failureCategory
// objetivo para diagnosticar. Se sintetiza desde la última señal real de
// quick-check — "refused" (patch vacío por zona prohibida) mapea a
// "Security", lo cual además dispara correctamente la regla dura de Recovery
// de escalar siempre ante Security, en vez de reintentar algo imposible.
function categoryFromQuickCheckSignal(signal: string | undefined): FailureCategory {
  switch (signal) {
    case "test":
      return "Tests";
    case "refused":
      return "Security";
    case "compile":
    case "apply":
    default:
      return "Compilation";
  }
}

// Adaptador entre OrchestratorState y ImplementationState/ValidationState/
// QualityGateState (mismo patrón que los adaptadores de Knowledge Engine y
// Planner): a diferencia de esos dos, este invoca los TRES subgrafos POR
// TASK del plan (el Orchestrator itera state.plan.order, no los subgrafos —
// Capa 4 sección 8), en secuencia: Implementation Loop, Validation Pipeline
// y — solo si esa pasó — Quality Gate (Capa 7, reutilizando la misma
// evidencia de Capa 5, nunca re-corriendo compile/tests/security).
//
// Reanudación tras Recovery (Capa 6): si state.failedTaskId apunta a una
// posición del plan, se retoma desde ahí en vez de desde el principio —
// las tasks anteriores ya pasaron y no hace falta rehacerlas. Si además hay
// un targetedFixTask (Recovery decidió retry/partial_retry/change_model), esa
// task acotada SUSTITUYE a la original solo en esa posición; el resto del
// plan sigue igual. "targetedFixTask" nunca se usa como el id de reanudación
// — failedTaskId siempre apunta al id original del plan, así que reintentos
// sucesivos de la misma task siguen encontrando la posición correcta.
export async function implementationNode(state: OrchestratorStateType) {
  const ticket = state.currentTicket;
  if (!ticket) return failFast("No hay currentTicket; nada que implementar.");

  const plan = state.plan;
  if (!plan) {
    return failFast(`Ticket ${ticket.id}: no hay plan validado (Planning no llegó a "valid"); se escala a Recovery.`);
  }

  if (plan.order.length === 0) {
    // Un plan "valid" con cero tasks (posible si Discovery no encontró
    // dependencias pero sí mitigó su propio gap de entendimiento, ver
    // validatePlanNode) no significa "nada que hacer" — significa que
    // Planning no produjo ninguna task accionable para este ticket. Un
    // "pass" vacío sería un éxito hueco; se trata como fail para que
    // Recovery decida (p. ej. volver a Discovery con más contexto).
    return failFast(`Ticket ${ticket.id}: el plan validado no contiene tasks accionables; se escala a Recovery.`);
  }

  const executionPlan = resolveExecutionPlan(plan, state.failedTaskId, state.targetedFixTask);

  let tasksRun = 0;
  let failedTaskId: string | null = null;
  let failedSandboxPath: string | null = null;
  let failureCategory: FailureCategory | null = null;
  let validationEvidence: StageResult[] = [];
  let patchAttempts: OrchestratorStateType["patchAttempts"] = [];
  let qualityGateIssues: Issue[] = [];
  let mergeConflict: ConflictReport | null = null;
  let failureReason: string | null = null;
  const followUpTickets: Ticket[] = [];
  const promotedTaskIds: string[] = [];
  const mergeManagerConfig = loadMergeManagerConfig();

  for (const { taskId, task } of executionPlan) {
    const implResult = await implementationWorkflow.invoke({ task });
    tasksRun += 1;

    if (implResult.outcome === "escalate") {
      failedTaskId = taskId;
      failedSandboxPath = implResult.sandboxPath;
      failureCategory = categoryFromQuickCheckSignal(implResult.quickCheck?.signal);
      validationEvidence = [];
      patchAttempts = implResult.patchAttempts;
      failureReason = `Implementation Loop escaló tras agotar sus intentos (quick-check: ${implResult.quickCheck?.detail ?? "sin detalle"})`;
      break; // Recovery (Capa 6) decide qué hacer con el resto del plan
    }

    // La task compiló/testeó lo mínimo (quick-check); ahora la Validation
    // Pipeline es la que da el veredicto real y objetivo (Capa 5, sección 0:
    // "evidencia, no opiniones" — sin esto, "ready_for_validation" nunca se
    // valida de verdad).
    const validationResult = await validationPipelineWorkflow.invoke({
      sandboxPath: implResult.sandboxPath ?? "",
      patch: implResult.patch,
      task,
    });

    if (validationResult.verdict === "fail") {
      failedTaskId = taskId;
      failedSandboxPath = implResult.sandboxPath;
      failureCategory = validationResult.failureCategory;
      validationEvidence = validationResult.results;
      patchAttempts = implResult.patchAttempts;
      failureReason = `Validation Pipeline: fail en categoría "${validationResult.failureCategory}"`;
      break;
    }

    // Solo si Validation Pipeline dio "pass": Quality Gate (Capa 7) reutiliza
    // esa misma evidencia — nunca vuelve a compilar/testear/escanear.
    const qgResult = await qualityGateWorkflow.invoke({
      sandboxPath: implResult.sandboxPath ?? "",
      patch: implResult.patch,
      task,
      plan,
      validationEvidence: validationResult.results,
    });

    if (qgResult.verdict === "blocking") {
      failedTaskId = taskId;
      failedSandboxPath = implResult.sandboxPath;
      // failureCategory queda null a propósito: compile/tests ya pasaron
      // (Capa 5), el problema lo encontró el Quality Gate — diagnoseNode
      // (Capa 6) sabe leer qualityGateIssues cuando failureCategory es null.
      failureCategory = null;
      validationEvidence = [];
      patchAttempts = implResult.patchAttempts;
      qualityGateIssues = qgResult.issues.filter((i) => i.severity === "blocking");
      failureReason = `Quality Gate: blocking (${qgResult.issues.map((i) => i.dimension).join(", ")})`;
      break;
    }

    // Un ticket que YA es de seguimiento (origin:"quality_gate") no genera
    // otra ronda — sin este tope, un advisory persistente (p. ej. cobertura
    // bajando un poco en cada cambio) encolaría tickets sin fin.
    if (qgResult.verdict === "advisory_only" && ticket.origin !== "quality_gate") {
      followUpTickets.push(...toFollowUpTickets(ticket.id, taskId, qgResult.issues));
    }

    // Solo si Quality Gate no bloqueó: Merge Manager (Capa 8) promueve el
    // patch YA validado al árbol real (process.cwd() — nunca otro sandbox).
    // Sin git, un conflicto real (el archivo real divergió del snapshot que
    // el sandbox usó) escala directo — nunca pasa por el retry normal de
    // Recovery, ver el nuevo hard rule en decideStrategyNode.
    const mmResult = await mergeManagerWorkflow.invoke({
      task,
      patch: implResult.patch,
      targetPath: process.cwd(),
      dryRun: mergeManagerConfig.mergeManager.dryRun,
    });

    if (mmResult.conflictReport?.hasConflicts) {
      failedTaskId = taskId;
      failedSandboxPath = implResult.sandboxPath;
      failureCategory = null;
      validationEvidence = [];
      patchAttempts = implResult.patchAttempts;
      mergeConflict = mmResult.conflictReport;
      failureReason = `Merge Manager: conflicto irresoluble (${mmResult.conflictReport.files.join(", ")})`;
      break;
    }

    promotedTaskIds.push(taskId);

    // Éxito de punta a punta para esta task: no hace falta conservar el
    // sandbox (gobernanza solo exige preservarlo cuando se escala/falla,
    // para inspección humana) — el patch ya vive en el árbol real (o, en
    // dryRun, ya se probó que aplicaría limpio).
    if (implResult.sandboxPath) cleanupSandbox(implResult.sandboxPath);
  }

  const usedTokens = SIMULATED_TOKENS_PER_TASK * tasksRun;
  const usedCostUsd = SIMULATED_COST_USD_PER_TASK * tasksRun;
  const tokenBudget = { limit: state.tokenBudget.limit, used: state.tokenBudget.used + usedTokens };
  const costBudget = {
    limitUsd: state.costBudget.limitUsd,
    usedUsd: Number((state.costBudget.usedUsd + usedCostUsd).toFixed(4)),
  };

  if (failedTaskId) {
    return {
      ...failFast(
        `Ticket ${ticket.id}: task ${failedTaskId} falló (${failureReason}). Sandbox para inspección: ${failedSandboxPath}.`
      ),
      tokenBudget,
      costBudget,
      failedTaskId,
      failedSandboxPath,
      failureCategory,
      validationEvidence,
      patchAttempts,
      qualityGateIssues,
      mergeConflict,
      // el targetedFixTask que trajo esta pasada ya se consumió — Recovery
      // preparará uno nuevo si vuelve a decidir retry/partial_retry/change_model
      targetedFixTask: null,
    };
  }

  // "git tag" + "close ticket" sin git (how-to §3): una sola entrada de
  // release log por TICKET (no por task, a diferencia del resto de este
  // loop) — ver releaseLog.ts sobre por qué vive acá y no como nodo del
  // subgrafo de Merge Manager.
  appendReleaseLogEntry(ticket, promotedTaskIds, mergeManagerConfig.mergeManager.dryRun, mergeManagerConfig);

  const backlog = [
    ...state.backlog.map((t) => (t.id === ticket.id ? { ...t, status: "done" as const } : t)),
    ...followUpTickets,
  ];

  return {
    backlog,
    currentTicket: null,
    lastImplementationResult: "pass" as const,
    tokenBudget,
    costBudget,
    // limpieza de segunda instancia (la primera es selectNextTicketNode al
    // elegir el SIGUIENTE ticket) — deja el estado consistente ya en el
    // momento del éxito, no solo cuando se selecciona otro ticket después.
    failureCategory: null,
    validationEvidence: [],
    patchAttempts: [],
    qualityGateIssues: [],
    mergeConflict: null,
    recoveryHistory: [],
    failedTaskId: null,
    targetedFixTask: null,
    failedSandboxPath: null,
    decisionLog: [
      decisionEntry(
        "implementation",
        `Ticket ${ticket.id}: ${tasksRun} task(s) del plan pasaron Implementation Loop + Validation Pipeline + ` +
          `Quality Gate + Merge Manager de punta a punta` +
          (followUpTickets.length > 0 ? ` (${followUpTickets.length} ticket(s) de seguimiento encolados).` : ".")
      ),
    ],
  };
}
