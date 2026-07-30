import { Annotation } from "@langchain/langgraph";
import type { PlanTask } from "../planner/types.js";
import type { Patch } from "../implementation/types.js";
import type { ConflictReport } from "./types.js";

export const MergeManagerState = Annotation.Root({
  task: Annotation<PlanTask | null>({ reducer: (_, n) => n, default: () => null }),
  patch: Annotation<Patch | null>({ reducer: (_, n) => n, default: () => null }),
  // Raíz real donde promover el patch — process.cwd() para el Orchestrator
  // real, un directorio descartable para tests/demo. Nunca un sandbox: el
  // sandbox de la task ya cumplió su propósito (Implementation + Validation
  // + Quality Gate ya corrieron sobre él).
  targetPath: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  dryRun: Annotation<boolean>({ reducer: (_, n) => n, default: () => true }),

  conflictReport: Annotation<ConflictReport | null>({ reducer: (_, n) => n, default: () => null }),
  promoted: Annotation<boolean>({ reducer: (_, n) => n, default: () => false }),
  escalationReason: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
});

export type MergeManagerStateType = typeof MergeManagerState.State;
