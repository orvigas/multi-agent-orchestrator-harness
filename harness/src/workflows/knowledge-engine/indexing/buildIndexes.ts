// Indexing separado del loop de retrieval en caliente (ver
// 02-knowledge-engine-loop-howto.md, sección 4): cada builder memoiza su
// trabajo en un cache a nivel de módulo, así que se corre una sola vez por
// proceso sin importar cuántas veces lo llamen los nodos del loop.
// Se puede correr como job aparte con `npm run kb:index`.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Project } from "ts-morph";
import { detectStack } from "../../../services/stack.js";
import { loadContextLayer, type ContextLayer } from "../../../config/loadContext.js";
import { termFreq, tokenize, computeIdf } from "../tools/textUtils.js";
import { makeEvidenceId } from "../tools/evidence.js";

const MAX_CHUNK_LINES = 60;

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, acc);
    // Los tests no son evidencia de código real para un ticket, y sin esta
    // exclusión los propios tests del Knowledge Engine se auto-matchearían
    // (contienen las queries de prueba como strings literales).
    else if (entry.name.endsWith(".test.ts")) continue;
    else if (exts.some((ext) => entry.name.endsWith(ext))) acc.push(full);
  }
  return acc;
}

// Globs dinámicos según stack detectado
const CODE_GLOBS_BY_LANGUAGE: Record<string, string[]> = {
  typescript: ["src", "test", "tests"],
  javascript: ["src", "lib", "test", "tests"],
  python: ["src", "tests"],
  go: ["cmd", "internal"],
};

export function listRepoFiles(targetPath?: string): string[] {
  const root = targetPath ?? process.cwd();
  const stack = detectStack(root);

  const codeGlobs = CODE_GLOBS_BY_LANGUAGE[stack.language] || CODE_GLOBS_BY_LANGUAGE.typescript;
  const codeFiles = codeGlobs.flatMap((glob) => walk(path.join(root, glob), [".ts", ".js", ".py", ".go"]));

  // .harness/ siempre se incluye si existe (reglas y arquitectura)
  const contextFiles = walk(path.join(root, ".harness"), [".md"]);

  return [...codeFiles, ...contextFiles];
}

let structuralProject: Project | null = null;
let structuralProjectPath: string | null = null;

export function buildStructuralIndex(targetPath?: string): Project {
  const root = targetPath ?? process.cwd();
  // Cache solo es válido si es para el mismo targetPath
  if (structuralProject && structuralProjectPath === root) return structuralProject;

  const tsconfigPath = path.resolve(root, "tsconfig.json");
  structuralProject = new Project({
    tsConfigFilePath: fs.existsSync(tsconfigPath) ? tsconfigPath : undefined,
  });
  structuralProjectPath = root;
  return structuralProject;
}

export interface VectorChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  text: string;
  termFreq: Map<string, number>;
}

export interface VectorIndex {
  chunks: VectorChunk[];
  idf: Map<string, number>;
}

let vectorIndex: VectorIndex | null = null;
let vectorIndexPath: string | null = null;

export function buildVectorIndex(targetPath?: string): VectorIndex {
  const root = targetPath ?? process.cwd();
  // Cache solo es válido si es para el mismo targetPath
  if (vectorIndex && vectorIndexPath === root) return vectorIndex;

  const chunks: VectorChunk[] = [];

  for (const file of listRepoFiles(root)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let start = 0; start < lines.length; start += MAX_CHUNK_LINES) {
      const end = Math.min(start + MAX_CHUNK_LINES, lines.length);
      const text = lines.slice(start, end).join("\n");
      if (!text.trim()) continue;
      const relPath = path.relative(root, file);
      chunks.push({
        id: makeEvidenceId(relPath, start + 1, end),
        filePath: relPath,
        startLine: start + 1,
        endLine: end,
        text,
        termFreq: termFreq(tokenize(text)),
      });
    }
  }

  vectorIndex = { chunks, idf: computeIdf(chunks) };
  vectorIndexPath = root;
  return vectorIndex;
}

let staticContextCache: ContextLayer[] | null = null;
let staticContextPath: string | null = null;

// .harness/rules + .harness/architecture (incl. ADRs): se cargan completos,
// nunca se buscan con AI, porque son pequeños y estables (mismo patrón
// "progressive disclosure" que CLAUDE.md).
export function loadStaticContext(targetPath?: string): ContextLayer[] {
  const root = targetPath ?? process.cwd();
  // Cache solo es válido si es para el mismo targetPath
  if (staticContextCache && staticContextPath === root) return staticContextCache;
  staticContextCache = [...loadContextLayer("rules", root), ...loadContextLayer("architecture", root)];
  staticContextPath = root;
  return staticContextCache;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const structural = buildStructuralIndex();
  const vector = buildVectorIndex();
  const staticContext = loadStaticContext();
  console.log(`Structural index (ts-morph): ${structural.getSourceFiles().length} archivos .ts parseados.`);
  console.log(`Vector index (TF-IDF): ${vector.chunks.length} chunks de hasta ${MAX_CHUNK_LINES} líneas.`);
  console.log(`Static context (.harness): ${staticContext.length} archivos .md cargados.`);
}
