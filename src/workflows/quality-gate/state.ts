import { Annotation } from "@langchain/langgraph";
import type { StageResult } from "../validation-pipeline/types.js";
import type { Plan, PlanTask } from "../planner/types.js";
import type { Patch } from "../implementation/types.js";
import type { CoverageResult, SonarResult, ReviewFinding, Issue } from "./types.js";

export const QualityGateState = Annotation.Root({
  // Reutilizado, no regenerado
  validationEvidence: Annotation<StageResult[]>({ reducer: (_, n) => n, default: () => [] }),
  plan: Annotation<Plan | null>({ reducer: (_, n) => n, default: () => null }),
  // No declarado en el how-to (que solo tiene `plan`), pero necesario para
  // saber A QUÉ task del plan pertenece este patch — mismo gap que
  // ValidationState (Capa 5) ya resolvió con su propio campo `task`.
  task: Annotation<PlanTask | null>({ reducer: (_, n) => n, default: () => null }),
  patch: Annotation<Patch | null>({ reducer: (_, n) => n, default: () => null }),
  sandboxPath: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),

  // Nuevo en esta capa
  coverageDelta: Annotation<CoverageResult | null>({ reducer: (_, n) => n, default: () => null }),
  sonarResult: Annotation<SonarResult | null>({ reducer: (_, n) => n, default: () => null }),
  architectureReview: Annotation<ReviewFinding | null>({ reducer: (_, n) => n, default: () => null }),
  documentationReview: Annotation<ReviewFinding | null>({ reducer: (_, n) => n, default: () => null }),

  // Salida final: SOLO esto sale del Quality Gate
  issues: Annotation<Issue[]>({ reducer: (_, n) => n, default: () => [] }),
  verdict: Annotation<"clear" | "advisory_only" | "blocking">({
    reducer: (_, n) => n,
    default: () => "clear",
  }),
});

export type QualityGateStateType = typeof QualityGateState.State;
