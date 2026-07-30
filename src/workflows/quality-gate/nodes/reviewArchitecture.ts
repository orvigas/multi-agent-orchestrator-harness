import type { QualityGateStateType } from "../state.js";
import type { ReviewFinding } from "../types.js";

const WORKFLOWS_LAYER = /^src\/workflows\/([^/]+)\//;

// Stand-in determinista para el rol "quality_gate_reviewer" (review de
// arquitectura): .harness/architecture/patterns.md documenta cada capa
// (knowledge-engine, planner, implementation, validation-pipeline, recovery,
// quality-gate) como aislada entre sí, comunicándose solo a través de los
// adaptadores en src/orchestrator/nodes/ — nunca importándose directamente
// entre capas hermanas. Si una sola task toca archivos de más de una capa
// `src/workflows/<layer>/` a la vez, eso es exactamente el tipo de cruce de
// frontera que el patrón documentado prohíbe.
export function reviewArchitectureNode(state: QualityGateStateType): { architectureReview: ReviewFinding } {
  const touchesFiles = state.task?.touchesFiles ?? [];
  const layersTouched = new Set(
    touchesFiles.map((file) => file.match(WORKFLOWS_LAYER)?.[1]).filter((layer): layer is string => Boolean(layer))
  );

  if (layersTouched.size <= 1) {
    return { architectureReview: { compliant: true, findings: [] } };
  }

  return {
    architectureReview: {
      compliant: false,
      findings: [
        `La task toca archivos de ${layersTouched.size} capas distintas (${[...layersTouched].join(", ")}) — ` +
          ".harness/architecture/patterns.md documenta cada workflow como aislado, comunicándose solo vía adaptadores.",
      ],
    },
  };
}
