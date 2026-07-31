export interface PatchHunk {
  file: string;
  contextBefore: string[]; // 2-3 líneas antes, tal cual existen en el archivo
  oldLines: string[]; // lo que se reemplaza (debe matchear exacto o casi-exacto)
  newLines: string[]; // el reemplazo
  contextAfter: string[];
}

export interface Patch {
  taskId: string;
  hunks: PatchHunk[];
  rationale: string; // por qué este cambio satisface la task, para el Quality Gate
}

export interface QuickCheckResult {
  passed: boolean;
  signal: "compile" | "test" | "apply" | "refused";
  detail: string;
}

export interface PatchAttempt {
  iteration: number;
  patch: Patch;
  quickCheckResult: QuickCheckResult | null;
}
