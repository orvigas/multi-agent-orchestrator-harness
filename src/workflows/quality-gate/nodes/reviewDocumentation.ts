import type { QualityGateStateType } from "../state.js";
import type { ReviewFinding } from "../types.js";

// Rutas de "superficie pública": si un patch las toca, introduce o cambia
// comportamiento visible (script npm, config de un rol/capa, el entry point
// del demo) que debería reflejarse en la documentación del proyecto.
const PUBLIC_SURFACE_PATTERNS = [/^package\.json$/, /^config\/.+\.yml$/, /^src\/index\.ts$/];

// Archivos que cuentan como "sí se documentó" si aparecen en el mismo patch.
const DOC_PATTERNS = [/^\.claude\/CLAUDE\.md$/, /^\.harness\/architecture\/.+\.md$/];

// Stand-in determinista para el rol "quality_gate_reviewer" (review de
// documentación): compliant:false SOLO cuando hay una omisión concreta y
// señalable (toca superficie pública sin tocar ningún doc en el mismo
// patch) — nunca por "podría documentarse mejor" en general.
export function reviewDocumentationNode(state: QualityGateStateType): { documentationReview: ReviewFinding } {
  const touchesFiles = state.task?.touchesFiles ?? [];
  const touchedPublicSurface = touchesFiles.filter((file) => PUBLIC_SURFACE_PATTERNS.some((p) => p.test(file)));

  if (touchedPublicSurface.length === 0) {
    return { documentationReview: { compliant: true, findings: [] } };
  }

  const touchedDocs = touchesFiles.some((file) => DOC_PATTERNS.some((p) => p.test(file)));
  if (touchedDocs) {
    return { documentationReview: { compliant: true, findings: [] } };
  }

  return {
    documentationReview: {
      compliant: false,
      findings: [
        `El patch toca superficie pública (${touchedPublicSurface.join(", ")}) sin actualizar ningún doc ` +
          "(.claude/CLAUDE.md o .harness/architecture/*.md) en el mismo patch.",
      ],
    },
  };
}
