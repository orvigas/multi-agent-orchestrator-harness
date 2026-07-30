import type { ImplementationStateType } from "../state.js";

// Se alcanza al agotar maxIterations sin un patch que pase su quick-check.
// Por gobernanza (config/implementation.yml: cleanupOnEscalate: false), el
// sandbox del último intento fallido NO se borra — queda para inspección
// humana. La política real de escalamiento es Recovery Loop (Capa 6),
// todavía no construido; este nodo solo deja el estado tal cual para que
// el adaptador del Orchestrator lo registre.
export function escalateNode(_state: ImplementationStateType) {
  return {};
}
