import fs from "node:fs";
import path from "node:path";

export interface ContextLayer {
  source: "global" | "project" | "local";
  file: string;
  content: string;
}

// Busca .harness/ hacia arriba desde cwd (es compartido por el harness y el proyecto host)
function findContextRoot(): string {
  let current = process.cwd();
  const root = path.parse(current).root;

  while (current !== root) {
    const harnessDir = path.join(current, ".harness");
    if (fs.existsSync(harnessDir)) {
      return harnessDir;
    }
    current = path.dirname(current);
  }

  // Si no encontró .harness/, usa cwd como fallback
  return path.join(process.cwd(), ".harness");
}

function getLayerDirs(targetPath?: string): Array<{ source: ContextLayer["source"]; dir: string }> {
  const contextRoot = findContextRoot();
  return [
    { source: "global" as const, dir: contextRoot },
    { source: "project" as const, dir: contextRoot },
    { source: "local" as const, dir: path.join(path.dirname(contextRoot), ".harness.local") },
  ];
}

// Plantillas genéricas para cuando target no tiene .harness/
const GENERIC_TEMPLATES: Record<string, string> = {
  rules: `# Zonas prohibidas (plantilla genérica)

El Implementation Loop NUNCA debe escribir en:
- secrets/
- **/*.pem, **/*.key
- vendor/ (dependencias externas)
- legacy/ (código congelado)
- node_modules/ (dependencias)
`,

  architecture: `# Arquitectura (plantilla genérica)

Sin información específica del proyecto.
Aplicar convenciones estándar del lenguaje.
`,

  governance: `# Gobernanza (plantilla genérica)

Sin restricciones específicas del proyecto.
Usar valores por defecto.
`,
};

// Cache memoizado por clave (kind + targetPath) para evitar
// releer .harness/**/*.md en cada iteración del nodo
const cache = new Map<string, ContextLayer[]>();

export function loadContextLayer(kind: "rules" | "architecture" | "governance", targetPath?: string): ContextLayer[] {
  const cacheKey = `${kind}:${targetPath ?? process.cwd()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const layers: ContextLayer[] = [];
  const seenDirs = new Set<string>();

  for (const { source, dir } of getLayerDirs(targetPath)) {
    if (seenDirs.has(dir)) continue;
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

  // Si no encontró nada en el proyecto, usa plantilla genérica
  if (layers.length === 0) {
    layers.push({
      source: "project",
      file: `<template: ${kind}>`,
      content: GENERIC_TEMPLATES[kind],
    });
  }

  cache.set(cacheKey, layers);
  return layers;
}

// Ensambla el bloque de contexto que se inyecta al nodo correspondiente
// (planner lee architecture+rules, quality-gate lee governance, etc.)
export function buildContextBlock(kind: "rules" | "architecture" | "governance", targetPath?: string): string {
  return loadContextLayer(kind, targetPath)
    .map((l) => `<!-- source:${l.source} file:${path.basename(l.file)} -->\n${l.content}`)
    .join("\n\n---\n\n");
}
