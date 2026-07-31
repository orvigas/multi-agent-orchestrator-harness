export interface DiscoveryResult {
  problems: string[];
  dependencies: string[];
  risks: { description: string; severity: "low" | "medium" | "high" }[];
}

export interface PlanTask {
  id: string;
  description: string;
  touchesFiles: string[];

  // Campos que consume el Implementation Loop (Capa 4) para elegir patrón
  // de loop en selectPatternNode; el how-to de la Capa 3 no los declara
  // porque son de una capa futura desde su punto de vista.
  hasExistingTest?: boolean;
  expectedBehaviorIsTestable?: boolean;
  language?: "typed" | "untyped";
  kind?: "refactor" | "migration" | "feature" | "fix" | "targeted_fix";
  relatedTestId?: string;

  // Consumido por la Validation Pipeline (Capa 5) para decidir si la etapa
  // "performance" corre (governance §6); tampoco existía antes de esa capa.
  riskLevel?: "low" | "medium" | "high";
}

export interface Plan {
  tasks: PlanTask[];
  order: string[]; // ids en orden de ejecución
  dependencies: Record<string, string[]>; // taskId -> [taskIds de los que depende]
}

export interface PlanRevision {
  iteration: number;
  plan: Plan;
  rejectedBy?: ValidationIssue[];
}

export interface ValidationIssue {
  rule: string; // qué regla de .harness/ se violó
  detail: string;
  rootCause: "plan_error" | "discovery_gap"; // clave anti-fijación
  // Archivo concreto al que aplica el issue (p. ej. una violación de
  // forbidden-zones) — estructurado en vez de tener que buscarlo por
  // substring dentro de `detail`.
  file?: string;
}
