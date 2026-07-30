import { Annotation } from "@langchain/langgraph";
import type { Ticket } from "../../orchestrator/types.js";
import type { EvidenceItem, RetrievalAction } from "./types.js";

export function dedupeById(items: EvidenceItem[]): EvidenceItem[] {
  const byId = new Map<string, EvidenceItem>();
  for (const item of items) byId.set(item.id, item); // last write wins
  return [...byId.values()];
}

export const KnowledgeState = Annotation.Root({
  ticket: Annotation<Ticket | null>({ reducer: (_, n) => n, default: () => null }),

  // Qué se ha intentado y qué se descartó — evita repetir búsquedas
  triedQueries: Annotation<string[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  discardedEvidence: Annotation<EvidenceItem[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Evidencia confirmada (esto es lo único que sale del loop)
  confirmedEvidence: Annotation<EvidenceItem[]>({
    reducer: (prev, next) => dedupeById(prev.concat(next)),
    default: () => [],
  }),

  // Control del loop (explore-narrow)
  iteration: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxIterations: Annotation<number>({ reducer: (_, n) => n, default: () => 5 }),
  nextAction: Annotation<RetrievalAction | null>({ reducer: (_, n) => n, default: () => null }),
  sufficiency: Annotation<"insufficient" | "sufficient" | "escalate">({
    reducer: (_, n) => n,
    default: () => "insufficient",
  }),

  // Límites de gobernanza cargados desde config/knowledge-engine.yml en
  // load_static_context (no está en el snippet del how-to, pero
  // assemble_package y las tools lo necesitan para respetar los caps).
  retrievalConfig: Annotation<{ maxEvidenceItems: number; maxLinesPerItem: number } | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),

  // Salida final de assemble_package: `confirmedEvidence` solo crece (su
  // reducer concatena+dedupea), así que no se puede recortar al cap de
  // gobernanza in place. Este campo, con reducer de sobreescritura, guarda
  // el paquete ya recortado que consume la Capa 3 (Planner).
  evidencePackage: Annotation<EvidenceItem[] | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
});

export type KnowledgeStateType = typeof KnowledgeState.State;
