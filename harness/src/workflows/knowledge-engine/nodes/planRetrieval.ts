import type { KnowledgeStateType } from "../state.js";
import type { RetrievalAction } from "../types.js";

// Stand-in determinista para el planner del loop (rol "retriever" en
// config/knowledge-engine.yml). El how-to lo describe como un modelo barato
// que decide UNA acción por vuelta vía RETRIEVER_PLANNER_PROMPT; aquí se
// aplican las mismas reglas como heurística sobre el texto del ticket, sin
// llamar a un modelo real (mismo patrón que los stubs de la Capa 1):
// - preferir "ast" para relaciones de código (implementa/llama a/extiende)
// - preferir "grep" para un nombre exacto o string literal
// - usar "vector" solo cuando el ticket es lenguaje natural sin términos exactos
// - nunca repetir una query ya intentada

// Transición interna minúscula->mayúscula (o "_"): distingue identificadores
// camelCase/PascalCase/snake_case reales ("OrchestratorState",
// "bootstrapNode", "routeAfterBudgetCheck") de palabras comunes del lenguaje
// natural ("Antes", "Orchestrator" a secas, o términos citados entre
// backticks que no son en realidad símbolos de código, como `deadline`).
function looksLikeCodeIdentifier(w: string): boolean {
  return /[a-z][A-Z]/.test(w) || w.includes("_");
}

function extractSymbols(text: string): string[] {
  const backticked = [...text.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]);
  const words = text.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
  const symbolLike = words.filter((w) => w.length > 3 && looksLikeCodeIdentifier(w));
  const all = [...new Set([...backticked, ...symbolLike])];
  // Prioriza los que parecen identificadores reales de código sobre
  // términos comunes citados entre backticks (p. ej. `deadline`, un campo,
  // no una declaración) — evita gastar iteraciones en símbolos que ast_query
  // nunca podrá resolver, antes de llegar al que sí puede.
  return all.sort((a, b) => Number(looksLikeCodeIdentifier(b)) - Number(looksLikeCodeIdentifier(a)));
}

function determineAstKindOrder(text: string): Array<"definition" | "usages" | "implements"> {
  const lower = text.toLowerCase();
  const order: Array<"definition" | "usages" | "implements"> = [];
  if (/implementa|extiende|hereda/.test(lower)) order.push("implements");
  if (/llama|usa|referencia|invoca/.test(lower)) order.push("usages");
  order.push("definition", "usages", "implements");
  return [...new Set(order)];
}

function pickDistinctiveWord(text: string, symbols: string[]): string | null {
  const words = (text.match(/\b[A-Za-zÁÉÍÓÚñÑ_]+\b/g) ?? []).filter((w) => w.length > 3);
  const candidates = words.filter((w) => !symbols.includes(w));
  const pool = candidates.length > 0 ? candidates : symbols;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => b.length - a.length)[0];
}

export function planRetrievalNode(state: KnowledgeStateType) {
  const ticket = state.ticket;
  const text = `${ticket?.title ?? ""} ${ticket?.description ?? ""}`.trim();
  const tried = new Set(state.triedQueries);
  const symbols = extractSymbols(text);
  const kindOrder = determineAstKindOrder(text);

  let action: RetrievalAction | null = null;

  for (const symbol of symbols) {
    for (const kind of kindOrder) {
      const query = `${kind}:${symbol}`;
      if (!tried.has(query)) {
        action = { tier: "ast", query };
        break;
      }
    }
    if (action) break;
  }

  if (!action) {
    const distinctiveWord = pickDistinctiveWord(text, symbols);
    if (distinctiveWord && !tried.has(distinctiveWord)) {
      action = { tier: "grep", query: distinctiveWord };
    }
  }

  if (!action) {
    const vectorQuery = text || "ticket sin descripción";
    action = { tier: "vector", query: tried.has(vectorQuery) ? `${vectorQuery} (ronda adicional)` : vectorQuery };
  }

  return {
    nextAction: action,
    triedQueries: [action.query],
    iteration: state.iteration + 1,
  };
}
