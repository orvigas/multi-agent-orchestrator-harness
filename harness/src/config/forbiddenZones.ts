// Reglas reales de .harness/rules/forbidden-zones.md, compartidas entre el
// Planner (Capa 3, validatePlan.ts) y el Implementation Loop (Capa 4,
// generatePatch.ts) — ambos necesitan la misma verificación de "¿esta ruta
// está prohibida?" contra el mismo contenido real.

// Extrae patrones de ruta reales de .harness/rules/forbidden-zones.md (vía
// buildContextBlock, Capa 1): solo tokens entre backticks que parecen rutas
// (con "/" o que empiezan con "*"), para no confundir nombres de símbolos
// citados en otras reglas (coding-style.md, testing.md) con rutas prohibidas.
export function extractForbiddenPatterns(rulesText: string): string[] {
  const tokens = [...rulesText.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  return tokens.filter((t) => t.includes("/") || t.startsWith("*"));
}

// Nota: solo se reconoce el glob "**/*.<ext>"; cualquier otro patrón
// (directorios como "secrets/", o un literal como "legacy/") se trata como
// substring plano. Cubre los patrones reales de forbidden-zones.md hoy; un
// glob genuino (minimatch/picomatch) sería más robusto si esas reglas crecen
// en variedad, pero eso es una dependencia nueva fuera del alcance de esta
// limpieza.
export function matchesForbiddenPattern(filePath: string, pattern: string): boolean {
  if (pattern.startsWith("**/*.")) {
    const ext = pattern.slice(pattern.lastIndexOf("."));
    return filePath.endsWith(ext);
  }
  return filePath.includes(pattern);
}
