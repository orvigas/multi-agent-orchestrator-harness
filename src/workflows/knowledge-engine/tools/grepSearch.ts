import fs from "node:fs";
import path from "node:path";
import { listRepoFiles } from "../indexing/buildIndexes.js";
import { lineWindow, makeEvidenceId } from "./evidence.js";
import type { EvidenceItem } from "../types.js";

// Nivel léxico (barato, exacto): coincidencia literal, no regex de usuario,
// para mantener el contrato simple entre el planner heurístico y esta tool.
export function grepSearch(query: string, maxLinesPerItem = 40, maxMatches = 5, targetPath?: string): EvidenceItem[] {
  const needle = query.toLowerCase();
  const results: EvidenceItem[] = [];
  const root = targetPath ?? process.cwd();

  for (const file of listRepoFiles(targetPath)) {
    if (results.length >= maxMatches) break;
    const lines = fs.readFileSync(file, "utf8").split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(needle)) continue;

      const { start, end } = lineWindow(i, lines.length, maxLinesPerItem);
      const relPath = path.relative(root, file);
      results.push({
        id: makeEvidenceId(relPath, start + 1, end),
        source: "grep",
        content: lines.slice(start, end).join("\n"),
        relevanceNote: `coincidencia literal de "${query}" en la línea ${i + 1}`,
      });
      break; // un match por archivo alcanza como evidencia
    }
  }

  return results;
}
