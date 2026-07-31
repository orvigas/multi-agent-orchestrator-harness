export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status?: "pending" | "in_progress" | "done" | "blocked";
  // Marca los tickets de seguimiento que genera el Quality Gate (Capa 7,
  // ver toFollowUpTickets) para que implementationNode sepa no generarles
  // OTRA ronda de seguimiento — sin este tope, un advisory persistente
  // (p. ej. cobertura que baja un poco en cada cambio) encolaría tickets
  // sin fin y el Orchestrator nunca terminaría (recursionLimit de LangGraph
  // reventando en vez de un backlog que converge).
  origin?: "quality_gate";
}

export interface DecisionEntry {
  timestamp: string;
  node: string;
  message: string;
}
