import { astQuery } from "../tools/astQuery.js";
import { grepSearch } from "../tools/grepSearch.js";
import { vectorSearch } from "../tools/vectorSearch.js";
import type { KnowledgeStateType } from "../state.js";
import type { EvidenceItem } from "../types.js";

export function executeRetrievalNode(state: KnowledgeStateType) {
  const action = state.nextAction;
  const maxLinesPerItem = state.retrievalConfig?.maxLinesPerItem ?? 40;

  if (!action) {
    return { discardedEvidence: [] as EvidenceItem[] };
  }

  const results =
    action.tier === "ast"
      ? astQuery(action.query, maxLinesPerItem)
      : action.tier === "grep"
        ? grepSearch(action.query, maxLinesPerItem)
        : vectorSearch(action.query, maxLinesPerItem);

  if (results.length === 0) {
    return {
      discardedEvidence: [
        {
          id: `${action.tier}:${action.query}#no-match`,
          source: action.tier,
          content: "",
          relevanceNote: `sin resultados para "${action.query}" (tier ${action.tier})`,
        } satisfies EvidenceItem,
      ],
    };
  }

  return { confirmedEvidence: results };
}
