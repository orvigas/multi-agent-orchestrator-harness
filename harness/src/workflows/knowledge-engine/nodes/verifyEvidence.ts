import type { KnowledgeStateType } from "../state.js";

// Stand-in determinista para el verificador (rol "kb_verifier"), independiente
// del planner heurístico (planRetrieval.ts) — principio de independencia del
// verificador: no confía en "se buscó algo" como señal de éxito, exige
// evidencia real y más de una vuelta de exploración antes de aceptar.
//
// Nota: a diferencia del how-to, este verificador nunca devuelve "escalate"
// directamente — esa decisión queda enteramente en manos de
// routeAfterVerification (nodes/routing.ts) al agotar maxIterations, tal
// como hace el propio código de ejemplo del how-to (que jamás lee un
// "escalate" devuelto por el verificador).
export function verifyEvidenceNode(state: KnowledgeStateType) {
  const hasRealEvidence = state.confirmedEvidence.some((item) => item.content.trim().length > 0);
  const cap = state.retrievalConfig?.maxEvidenceItems ?? 12;
  const completedEnoughRounds = state.iteration >= 2;
  const reachedCap = state.confirmedEvidence.length >= cap;

  const sufficiency = hasRealEvidence && (completedEnoughRounds || reachedCap) ? "sufficient" : "insufficient";

  return { sufficiency } as const;
}
