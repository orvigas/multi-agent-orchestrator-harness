import type { RecoveryStateType } from "../state.js";
import type { RecoveryEntry } from "../types.js";

// La UX real de escalar a un humano (notificación, ticket, etc.) queda fuera
// de alcance — el how-to nunca muestra el cuerpo de este nodo, solo lo
// referencia en el grafo. Registra el intento en recoveryHistory (para que
// quede constancia de que se escaló) y deja el sandbox intacto para
// inspección humana, tal como exige la gobernanza.
export function prepareEscalationNode(state: RecoveryStateType) {
  const entry: RecoveryEntry = {
    iteration: state.recoveryIteration,
    diagnosis: state.diagnosis!,
    strategyChosen: "abort",
  };

  return { recoveryHistory: [entry] };
}
