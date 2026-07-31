// Sin git (ver .harness/governance/merge-manager.md): un conflicto es "el
// contexto de al menos un hunk ya no calza en el árbol real" — no hay
// concepto de "ours/theirs" que resolver automáticamente, así que
// `resolvable` no existe acá (el how-to lo modela pero su propia
// implementación de referencia lo deja siempre en false).
export interface ConflictReport {
  hasConflicts: boolean;
  files: string[];
}

export interface ReleaseLogEntry {
  tag: string;
  ticketId: string;
  taskIds: string[];
  dryRun: boolean;
  timestamp: string;
}
