import type { KnowledgeStateType } from "../state.js";

// Solo se alcanza cuando sufficiency === "sufficient". Aplica el cap de
// gobernanza (retrieval.maxEvidenceItems en config/knowledge-engine.yml):
// si Planning (Capa 3) necesita más detalle de un item puntual, lo pide en
// una iteración siguiente — no se sube el límite global aquí.
//
// `confirmedEvidence` solo puede crecer (su reducer concatena+dedupea), así
// que el recorte se materializa en `evidencePackage`, no in place.
export function assemblePackageNode(state: KnowledgeStateType) {
  const cap = state.retrievalConfig?.maxEvidenceItems ?? 12;
  return { evidencePackage: state.confirmedEvidence.slice(0, cap) };
}
