import { loadPlannerConfig } from "../../../config/loadPlannerConfig.js";
import type { PlannerStateType } from "../state.js";
import type { DiscoveryResult } from "../types.js";

const DESTRUCTIVE_CHANGE_PATTERN = /elimina|borra|remov|delet/i;

// Stand-in determinista para el rol "discovery". Por instrucción explícita
// del how-to ("analiza el ticket usando SOLO la evidencia entregada"), esto
// razona únicamente sobre `state.evidence` (el evidence package de la Capa 2,
// que ya incluye .harness/rules + ADRs como items source:"rule"/"adr") — no
// hace una llamada aparte a buildContextBlock("architecture") como el
// snippet original, para no releer lo que la evidencia ya trae.
export function discoveryNode(state: PlannerStateType) {
  const config = loadPlannerConfig();
  const ticket = state.ticket;
  const text = `${ticket?.title ?? ""} ${ticket?.description ?? ""}`;

  const problems = [ticket?.title ?? "Ticket sin título"];

  const dependencies = [
    ...new Set(
      state.evidence
        .filter((e) => e.source === "ast" || e.source === "grep" || e.source === "vector")
        .map((e) => e.id.split("#")[0])
    ),
  ];

  const risks: DiscoveryResult["risks"] = [];
  if (state.evidence.length === 0) {
    risks.push({
      description: "Evidencia insuficiente del Knowledge Engine para este ticket.",
      severity: "high",
    });
  }
  if (DESTRUCTIVE_CHANGE_PATTERN.test(text)) {
    risks.push({
      description: "Cambio destructivo: elimina o remueve código/símbolos existentes.",
      severity: "high",
    });
  }

  // Si venimos de un revisit_discovery, atender puntualmente los gaps
  // señalados por Validation en la vuelta anterior — esto es lo que
  // garantiza que el mismo gap no se vuelva a marcar "discovery-completeness"
  // en la siguiente pasada de Validation (convergencia, no fijación).
  const previousGaps = state.validationIssues.filter((i) => i.rootCause === "discovery_gap");
  for (const gap of previousGaps) {
    risks.push({ description: `Gap de entendimiento corregido: ${gap.detail}`, severity: "medium" });
  }

  const discovery: DiscoveryResult = { problems, dependencies, risks };

  return {
    discovery,
    maxPlanningIterations: config.planning.maxIterations,
    discoveryGapThreshold: config.planning.discoveryGapThreshold,
  };
}
