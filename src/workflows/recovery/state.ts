import { Annotation } from "@langchain/langgraph";
import type { StageResult, FailureCategory } from "../validation-pipeline/types.js";
import type { PatchAttempt } from "../implementation/types.js";
import type { PlanTask } from "../planner/types.js";
import type { Issue } from "../quality-gate/types.js";
import type { ConflictReport } from "../merge-manager/types.js";
import type { Diagnosis, Strategy, RecoveryEntry } from "./types.js";

export const RecoveryState = Annotation.Root({
  // Target repo path (heredado del Orchestrator)
  targetPath: Annotation<string>({
    reducer: (_, next) => next,
    default: () => process.cwd(),
  }),

  // Entrada: lo que ya sabemos de capas anteriores
  failureCategory: Annotation<FailureCategory | null>({ reducer: (_, n) => n, default: () => null }),
  validationEvidence: Annotation<StageResult[]>({ reducer: (_, n) => n, default: () => [] }),
  patchAttempts: Annotation<PatchAttempt[]>({ reducer: (_, n) => n, default: () => [] }),
  // Fuente alternativa de evidencia (Capa 7): issues "blocking" del Quality
  // Gate cuando compile/tests ya pasaron y el problema lo encontró ESE
  // review, no Validation Pipeline. diagnoseNode las usa cuando
  // failureCategory es null.
  qualityGateIssues: Annotation<Issue[]>({ reducer: (_, n) => n, default: () => [] }),
  // Fuente alternativa de evidencia (Capa 8): un conflicto real detectado por
  // Merge Manager al promover un patch ya validado. diagnoseNode la revisa
  // ANTES que qualityGateIssues/failureCategory — si llegó hasta acá, compile/
  // tests/quality gate ya pasaron, y el problema es que el árbol real
  // divergió del snapshot del sandbox, no algo que Recovery pueda arreglar
  // reintentando el patch.
  mergeConflict: Annotation<ConflictReport | null>({ reducer: (_, n) => n, default: () => null }),
  recoveryHistory: Annotation<RecoveryEntry[]>({
    // memoria a través de MÚLTIPLES pasadas por Recovery
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // La task original que falló y el sandbox de su último intento — no
  // declarados en el state.ts del how-to, pero prepare_fix/prepare_rollback
  // los necesitan: touchesFiles de la task acotada nunca debe exceder los
  // de la task original (gobernanza §8), y el sandbox hay que limpiarlo o
  // conservarlo según la estrategia.
  failedTask: Annotation<PlanTask | null>({ reducer: (_, n) => n, default: () => null }),
  failedSandboxPath: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),

  // Salida de Diagnóstico
  diagnosis: Annotation<Diagnosis | null>({ reducer: (_, n) => n, default: () => null }),

  // Salida de Estrategia
  strategy: Annotation<Strategy>({ reducer: (_, n) => n, default: () => "retry" }),
  targetedFixTask: Annotation<PlanTask | null>({ reducer: (_, n) => n, default: () => null }),

  recoveryIteration: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxRecoveryIterations: Annotation<number>({ reducer: (_, n) => n, default: () => 3 }),
});

export type RecoveryStateType = typeof RecoveryState.State;
