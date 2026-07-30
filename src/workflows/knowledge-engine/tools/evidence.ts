// Helpers de formato compartidos por los tres tiers de retrieval (ast, grep,
// vector): la convención de id "path#Lstart-Lend" y la ventana de contexto
// alrededor de una línea encontrada se repetían con la misma fórmula en
// astQuery.ts y grepSearch.ts.

export function lineWindow(centerIndex: number, totalLines: number, maxLinesPerItem: number, before = 2) {
  const start = Math.max(0, centerIndex - before);
  const end = Math.min(totalLines, start + maxLinesPerItem);
  return { start, end };
}

export function makeEvidenceId(relPath: string, startLine: number, endLine?: number): string {
  return endLine === undefined ? `${relPath}#L${startLine}` : `${relPath}#L${startLine}-L${endLine}`;
}
