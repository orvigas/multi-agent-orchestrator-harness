import path from "node:path";
import type { Node, Project } from "ts-morph";
import { buildStructuralIndex } from "../indexing/buildIndexes.js";
import { lineWindow, makeEvidenceId } from "./evidence.js";
import type { EvidenceItem } from "../types.js";

// Protocolo de consulta del tier "ast" (no está especificado literalmente en
// el how-to, solo { tier, query }): "definition:<name>" | "usages:<name>" |
// "implements:<name>". El planner heurístico (planRetrieval.ts) genera
// queries en este formato.
type AstQueryKind = "definition" | "usages" | "implements";

function parseQuery(query: string): { kind: AstQueryKind; name: string } {
  const separatorIndex = query.indexOf(":");
  if (separatorIndex === -1) return { kind: "definition", name: query.trim() };
  const kindRaw = query.slice(0, separatorIndex).trim();
  const name = query.slice(separatorIndex + 1).trim();
  const kind: AstQueryKind = kindRaw === "usages" || kindRaw === "implements" ? kindRaw : "definition";
  return { kind, name };
}

function findNamedDeclaration(project: Project, name: string): Node | null {
  for (const sourceFile of project.getSourceFiles()) {
    for (const fn of sourceFile.getFunctions()) if (fn.getName() === name) return fn;
    for (const cls of sourceFile.getClasses()) if (cls.getName() === name) return cls;
    for (const itf of sourceFile.getInterfaces()) if (itf.getName() === name) return itf;
    for (const ta of sourceFile.getTypeAliases()) if (ta.getName() === name) return ta;
    for (const vd of sourceFile.getVariableDeclarations()) if (vd.getName() === name) return vd;
  }
  return null;
}

function toEvidence(node: Node, relevanceNote: string, maxLinesPerItem: number, targetPath?: string): EvidenceItem {
  const sourceFile = node.getSourceFile();
  const root = targetPath ?? process.cwd();
  const relPath = path.relative(root, sourceFile.getFilePath());
  const startLine = node.getStartLineNumber();
  const text = node.getFullText().trim().split("\n").slice(0, maxLinesPerItem).join("\n");
  return { id: makeEvidenceId(relPath, startLine), source: "ast", content: text, relevanceNote };
}

function findImplementations(project: Project, name: string, maxLinesPerItem: number, targetPath?: string): EvidenceItem[] {
  const results: EvidenceItem[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    for (const cls of sourceFile.getClasses()) {
      const heritage = [...cls.getImplements(), ...(cls.getExtends() ? [cls.getExtends()!] : [])];
      if (heritage.some((clause) => clause.getText().includes(name))) {
        results.push(toEvidence(cls, `clase "${cls.getName()}" implementa/extiende "${name}"`, maxLinesPerItem, targetPath));
      }
    }
  }
  return results;
}

function findUsages(declaration: Node, name: string, maxLinesPerItem: number, targetPath?: string): EvidenceItem[] {
  if (!("findReferencesAsNodes" in declaration)) return [];
  // @ts-expect-error -- findReferencesAsNodes existe en los nodos con nombre
  // (ReferenceFindableNode) pero no en el tipo base `Node` de ts-morph.
  const refs: Node[] = declaration.findReferencesAsNodes();
  const seen = new Set<string>();
  const results: EvidenceItem[] = [];
  const root = targetPath ?? process.cwd();

  for (const ref of refs) {
    const sourceFile = ref.getSourceFile();
    const relPath = path.relative(root, sourceFile.getFilePath());
    const line = ref.getStartLineNumber();
    const key = `${relPath}#${line}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const lines = sourceFile.getFullText().split("\n");
    const { start, end } = lineWindow(line, lines.length, maxLinesPerItem);
    results.push({
      id: makeEvidenceId(relPath, start + 1, end),
      source: "ast",
      content: lines.slice(start, end).join("\n"),
      relevanceNote: `referencia a "${name}" (uso, import o llamada)`,
    });
  }

  return results;
}

export function astQuery(query: string, maxLinesPerItem = 40, targetPath?: string): EvidenceItem[] {
  const project = buildStructuralIndex(targetPath);
  const { kind, name } = parseQuery(query);
  if (!name) return [];

  if (kind === "implements") return findImplementations(project, name, maxLinesPerItem, targetPath);

  const declaration = findNamedDeclaration(project, name);
  if (!declaration) return [];

  if (kind === "usages") return findUsages(declaration, name, maxLinesPerItem, targetPath);

  return [toEvidence(declaration, `definición de "${name}"`, maxLinesPerItem, targetPath)];
}
