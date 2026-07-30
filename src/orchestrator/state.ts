import { Annotation } from "@langchain/langgraph";
import { loadOrchestratorConfig } from "../config/loadOrchestratorConfig.js";
import type { Ticket, DecisionEntry } from "./types.js";
import type { OrchestratorConfig } from "../config/loadConfig.js";
import type { EvidenceItem } from "../workflows/knowledge-engine/types.js";
import type { Plan, PlanTask } from "../workflows/planner/types.js";
import type { StageResult, FailureCategory } from "../workflows/validation-pipeline/types.js";
import type { PatchAttempt } from "../workflows/implementation/types.js";
import type { RecoveryEntry } from "../workflows/recovery/types.js";
import type { Issue } from "../workflows/quality-gate/types.js";
import type { ConflictReport } from "../workflows/merge-manager/types.js";

export const OrchestratorState = Annotation.Root({
  // Target repo path (defaults to current working directory)
  targetPath: Annotation<string>({
    reducer: (_, next) => next,
    default: () => process.cwd(),
  }),

  // Backlog y prioridades
  backlog: Annotation<Ticket[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
  currentTicket: Annotation<Ticket | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Memoria de decisiones (no el detalle de ejecución, eso vive en Knowledge Engine)
  decisionLog: Annotation<DecisionEntry[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Retries y estrategia
  retryCount: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxRetries: Annotation<number>({ reducer: (_, n) => n, default: () => 3 }),
  strategy: Annotation<
    "retry" | "partial_retry" | "change_context" | "change_model" | "rollback" | "abort" | "continue"
  >({
    reducer: (_, n) => n,
    default: () => "continue",
  }),

  // Resultado del último paso de implementation, usado por routeAfterImplementation
  lastImplementationResult: Annotation<"pass" | "fail" | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),

  // Presupuestos — esto es lo que en LangGraph normalmente falta "de fábrica".
  // Defaults desde config/orchestrator.yml (antes hardcodeados acá Y en
  // src/index.ts por duplicado).
  tokenBudget: Annotation<{ limit: number; used: number }>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ limit: loadOrchestratorConfig().orchestrator.tokenBudget.limit, used: 0 }),
  }),
  costBudget: Annotation<{ limitUsd: number; usedUsd: number }>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ limitUsd: loadOrchestratorConfig().orchestrator.costBudget.limitUsd, usedUsd: 0 }),
  }),
  deadline: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),

  // Config cargada en boot (ver src/config/loadConfig.ts)
  config: Annotation<OrchestratorConfig | null>({ reducer: (_, n) => n, default: () => null }),

  // Evidencia del Knowledge Engine (Capa 2) para el ticket actual. Se
  // sobreescribe por ticket, no se acumula entre tickets: quien la necesita
  // (Planning) la consume inmediatamente después del nodo knowledge_engine.
  knowledgeEvidence: Annotation<EvidenceItem[]>({ reducer: (_, n) => n, default: () => [] }),

  // Plan validado del Planner (Capa 3) para el ticket actual. null si la
  // última corrida del Planner escaló sin llegar a un veredicto "valid".
  plan: Annotation<Plan | null>({ reducer: (_, n) => n, default: () => null }),

  // Contexto de fallo que Implementation (Capa 4) + Validation Pipeline
  // (Capa 5) dejan para que Recovery (Capa 6) diagnostique. Se resetean por
  // ticket en selectNextTicketNode, sin importar cómo terminó el ticket
  // anterior (pass, blocked, o recovery exitoso a mitad de camino).
  failureCategory: Annotation<FailureCategory | null>({ reducer: (_, n) => n, default: () => null }),
  validationEvidence: Annotation<StageResult[]>({ reducer: (_, n) => n, default: () => [] }),
  patchAttempts: Annotation<PatchAttempt[]>({ reducer: (_, n) => n, default: () => [] }),
  // Sandbox del intento fallido, para que Recovery lo limpie (rollback) o lo
  // conserve para inspección humana (abort) — ver nodes/prepareRollback.ts.
  failedSandboxPath: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),

  // Memoria de Recovery A TRAVÉS de múltiples pasadas por ese subgrafo para
  // el MISMO ticket (nunca se resetea entre invocaciones de recovery, solo
  // entre tickets) — es lo que permite detectar isRepeatedFailure. Un
  // array vacío explícito es la señal de "reset" (selectNextTicketNode al
  // elegir ticket nuevo, implementationNode al tener éxito): con un reducer
  // puramente acumulativo, devolver [] no limpiaría nada (prev.concat([])
  // === prev) — el mismo tipo de bug que ya se corrigió una vez con
  // evidencePackage en la Capa 2.
  recoveryHistory: Annotation<RecoveryEntry[]>({
    reducer: (prev, next) => (next.length === 0 ? [] : prev.concat(next)),
    default: () => [],
  }),

  // Qué task del plan falló (posición de reanudación) y la fix task acotada
  // que Recovery preparó para reemplazarla — null si no hay un fallo en
  // curso o si change_context/rollback acaba de invalidar el plan viejo.
  failedTaskId: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
  targetedFixTask: Annotation<PlanTask | null>({ reducer: (_, n) => n, default: () => null }),

  // Índice de rotación para change_model (config/recovery.yml ->
  // fallbackModelsForImplementer), persistido por ticket.
  implementerFallbackIndex: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),

  // Issues "blocking" del Quality Gate (Capa 7) para la task que lo generó
  // — fuente alternativa de evidencia para Recovery cuando compile/tests ya
  // pasaron en la Capa 5 (Quality Gate encontró el problema, no Validation
  // Pipeline). Mismo ciclo de vida que failureCategory/validationEvidence.
  qualityGateIssues: Annotation<Issue[]>({ reducer: (_, n) => n, default: () => [] }),

  // Conflicto real detectado por Merge Manager (Capa 8) al promover el patch
  // de una task ya validada — el archivo real divergió de lo que el sandbox
  // asumía. Mismo ciclo de vida que qualityGateIssues/failureCategory: nunca
  // pasa por el retry normal de Recovery (regla dura en decideStrategyNode),
  // solo existe para que diagnoseNode tenga evidencia real que reportar.
  mergeConflict: Annotation<ConflictReport | null>({ reducer: (_, n) => n, default: () => null }),
});

export type OrchestratorStateType = typeof OrchestratorState.State;
