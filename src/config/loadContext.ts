import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ContextLayer {
  source: "global" | "project" | "local";
  file: string;
  content: string;
}

const LAYER_DIRS = [
  { source: "global" as const, dir: path.resolve(__dirname, "../../.harness") },
  { source: "project" as const, dir: path.resolve(process.cwd(), ".harness") },
  { source: "local" as const, dir: path.resolve(process.cwd(), ".harness.local") },
];

// Memoizado por `kind`, igual que el resto de los config loaders del
// harness: sin esto, generatePatchNode (reintenta por iteración),
// validatePlanNode (reintenta por iteración de Planning) y recovery.subgraph.ts
// (una vez por intento de Recovery) releen .harness/**/*.md desde disco en
// cada vuelta del proceso, en vez de una sola vez.
const cache = new Map<string, ContextLayer[]>();

export function loadContextLayer(kind: "rules" | "architecture" | "governance"): ContextLayer[] {
  const cached = cache.get(kind);
  if (cached) return cached;

  const layers: ContextLayer[] = [];
  const seenDirs = new Set<string>();
  for (const { source, dir } of LAYER_DIRS) {
    if (seenDirs.has(dir)) continue; // evita duplicar cuando global === project (mismo repo)
    seenDirs.add(dir);
    const target = path.join(dir, kind);
    if (!fs.existsSync(target)) continue;
    for (const file of fs.readdirSync(target)) {
      if (!file.endsWith(".md")) continue;
      layers.push({
        source,
        file: path.join(target, file),
        content: fs.readFileSync(path.join(target, file), "utf8"),
      });
    }
  }
  // orden de carga = orden de precedencia: lo más específico va al final,
  // así queda más cerca de la "atención" del modelo si concatenas
  cache.set(kind, layers);
  return layers;
}

// Ensambla el bloque de contexto que se inyecta al nodo correspondiente
// (planner lee architecture+rules, quality-gate lee governance, etc.)
export function buildContextBlock(kind: "rules" | "architecture" | "governance"): string {
  return loadContextLayer(kind)
    .map((l) => `<!-- source:${l.source} file:${path.basename(l.file)} -->\n${l.content}`)
    .join("\n\n---\n\n");
}
