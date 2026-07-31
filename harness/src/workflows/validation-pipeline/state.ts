import { Annotation } from "@langchain/langgraph";
import type { Patch } from "../implementation/types.js";
import type { PlanTask } from "../planner/types.js";
import type { StageResult, FailureCategory } from "./types.js";

export const ValidationState = Annotation.Root({
  // Target repo path (heredado del Orchestrator)
  targetPath: Annotation<string>({
    reducer: (_, next) => next,
    default: () => process.cwd(),
  }),

  sandboxPath: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  patch: Annotation<Patch | null>({ reducer: (_, n) => n, default: () => null }),
  task: Annotation<PlanTask | null>({ reducer: (_, n) => n, default: () => null }),

  results: Annotation<StageResult[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  verdict: Annotation<"pass" | "fail" | null>({ reducer: (_, n) => n, default: () => null }),
  failureCategory: Annotation<FailureCategory | null>({ reducer: (_, n) => n, default: () => null }),
});

export type ValidationStateType = typeof ValidationState.State;
