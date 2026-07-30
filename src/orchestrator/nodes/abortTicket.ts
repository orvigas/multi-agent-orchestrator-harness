import { decisionEntry } from "../decisionLog.js";
import type { OrchestratorStateType } from "../state.js";

// Alcanzado cuando Recovery agota sus reintentos (routeAfterRecovery ->
// "abort"). El how-to de la Capa 1 mapea "abort" directo a END, lo que en la
// práctica termina TODO el run del Orchestrator por culpa de un solo ticket
// irrecuperable (comprobado en la integración de Capas 4/5: un ticket cuyo
// plan queda vacío, o cuya Validation Pipeline falla por una vulnerabilidad
// real de una dependencia transitiva, no debería impedir que el resto del
// backlog se procese). Este nodo marca el ticket actual como "blocked" (no
// reintentable por selectNextTicketNode) y vuelve a select_next_ticket para
// que el resto de los tickets sigan su curso — el diagnóstico real de por
// qué quedó bloqueado es trabajo de Recovery Loop (Capa 6), todavía no
// construido.
export function abortTicketNode(state: OrchestratorStateType) {
  const ticket = state.currentTicket;
  if (!ticket) return {};

  const backlog = state.backlog.map((t) => (t.id === ticket.id ? { ...t, status: "blocked" as const } : t));

  return {
    backlog,
    currentTicket: null,
    retryCount: 0, // el próximo ticket empieza sus propios reintentos desde cero
    decisionLog: [
      decisionEntry(
        "abort_ticket",
        `Ticket ${ticket.id}: Recovery agotó sus reintentos; se marca "blocked" y se continúa con el resto del backlog.`
      ),
    ],
  };
}
