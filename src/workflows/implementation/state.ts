import { Annotation } from "@langchain/langgraph";
import type { PlanTask } from "../planner/types.js";
import type { EvidenceItem } from "../knowledge-engine/types.js";
import type { Patch, PatchAttempt, QuickCheckResult } from "./types.js";

export const ImplementationState = Annotation.Root({
  // Target repo path (heredado del Orchestrator)
  targetPath: Annotation<string>({
    reducer: (_, next) => next,
    default: () => process.cwd(),
  }),

  task: Annotation<PlanTask | null>({ reducer: (_, n) => n, default: () => null }),
  taskContext: Annotation<EvidenceItem[]>({ reducer: (_, n) => n, default: () => [] }),

  selectedPattern: Annotation<"test_driven" | "compiler_driven" | "retry">({
    reducer: (_, n) => n,
    default: () => "retry",
  }),

  patch: Annotation<Patch | null>({ reducer: (_, n) => n, default: () => null }),
  patchAttempts: Annotation<PatchAttempt[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Señal rápida ANTES de mandarlo a la Validation Pipeline completa (Capa 5)
  quickCheck: Annotation<QuickCheckResult | null>({ reducer: (_, n) => n, default: () => null }),

  // Directorio del sandbox real (copia temporal, ver tools/sandbox.ts) del
  // último intento — referenciado por quickCheckNode en el how-to pero
  // nunca declarado en su state.ts.
  sandboxPath: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),

  iteration: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxIterations: Annotation<number>({ reducer: (_, n) => n, default: () => 3 }),
  outcome: Annotation<"ready_for_validation" | "escalate">({
    reducer: (_, n) => n,
    default: () => "ready_for_validation",
  }),
});

export type ImplementationStateType = typeof ImplementationState.State;
