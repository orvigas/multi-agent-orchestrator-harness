import { Annotation } from "@langchain/langgraph";
import type { Ticket } from "../../orchestrator/types.js";
import type { EvidenceItem } from "../knowledge-engine/types.js";
import type { DiscoveryResult, Plan, PlanRevision, ValidationIssue } from "./types.js";

export const PlannerState = Annotation.Root({
  ticket: Annotation<Ticket | null>({ reducer: (_, n) => n, default: () => null }),
  evidence: Annotation<EvidenceItem[]>({ reducer: (_, n) => n, default: () => [] }), // viene del Knowledge Engine

  // Salida de Discovery
  discovery: Annotation<DiscoveryResult | null>({ reducer: (_, n) => n, default: () => null }),

  // Salida de Planning
  plan: Annotation<Plan | null>({ reducer: (_, n) => n, default: () => null }),
  planRevisions: Annotation<PlanRevision[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Salida de Validation
  validationIssues: Annotation<ValidationIssue[]>({ reducer: (_, n) => n, default: () => [] }),
  validationVerdict: Annotation<"valid" | "invalid" | "escalate">({
    reducer: (_, n) => n,
    default: () => "invalid",
  }),

  // Control del loop macro y detección de plan fixation
  planningIteration: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxPlanningIterations: Annotation<number>({ reducer: (_, n) => n, default: () => 4 }),
  strategy: Annotation<"revise_plan" | "revisit_discovery" | "escalate" | "proceed">({
    reducer: (_, n) => n,
    default: () => "proceed",
  }),

  // % de issues "discovery_gap" que dispara revisit_discovery, cargado desde
  // config/planner.yml (no está en el snippet del how-to, que lo deja
  // hardcodeado en 0.5 dentro de routeAfterValidation).
  discoveryGapThreshold: Annotation<number>({ reducer: (_, n) => n, default: () => 0.5 }),
});

export type PlannerStateType = typeof PlannerState.State;
