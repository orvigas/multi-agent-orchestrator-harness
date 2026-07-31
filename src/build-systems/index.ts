import { BuildSystemRegistry } from "./BuildSystemRegistry.js";
import type { BuildSystem } from "./BuildSystem.js";

export * from "./BuildSystem.js";
export { BuildSystemRegistry } from "./BuildSystemRegistry.js";

// Built-in build systems would go here
// For now, they are registered as needed
const BUILTIN_BUILD_SYSTEMS: BuildSystem[] = [];

export function initializeBuildSystems(): void {
  for (const system of BUILTIN_BUILD_SYSTEMS) {
    BuildSystemRegistry.register(system);
  }
}
