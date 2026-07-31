import fs from "node:fs";
import yaml from "js-yaml";

// Fábrica compartida por todos los loaders de config *.yml del harness
// (cada Capa 2-5 tenía su propia copia idéntica de este patrón
// cache-lee-parsea). loadProvidersConfig (loadConfig.ts) es la excepción
// deliberada: valida variables de entorno además de parsear, así que no usa
// esta fábrica genérica.
export function createYamlConfigLoader<T>(defaultPath: string): (path?: string) => T {
  let cached: T | null = null;
  return (path = defaultPath): T => {
    if (!cached) cached = yaml.load(fs.readFileSync(path, "utf8")) as T;
    return cached;
  };
}
