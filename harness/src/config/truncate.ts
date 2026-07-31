// Compartido entre la Capa 4 (implementation/tools/quickChecks.ts) y la
// Capa 5 (validation-pipeline/tools/exec.ts): ambas truncaban evidencia de
// herramientas reales con el mismo contrato exacto, cada una con su propia
// copia.
export function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n... (truncado)` : text;
}
