import type { BuildSystem } from "./BuildSystem.js";

export class BuildSystemRegistry {
  private static systems: Map<string, BuildSystem> = new Map();

  static register(system: BuildSystem): void {
    BuildSystemRegistry.systems.set(system.name, system);
  }

  static getSystem(name: string): BuildSystem {
    const system = BuildSystemRegistry.systems.get(name);
    if (!system) {
      throw new Error(`No build system found: ${name}`);
    }
    return system;
  }

  static hasSystem(name: string): boolean {
    return BuildSystemRegistry.systems.has(name);
  }

  static supportedSystems(): string[] {
    return Array.from(BuildSystemRegistry.systems.keys());
  }

  static detectBuildSystem(rootPath: string): BuildSystem | null {
    for (const system of BuildSystemRegistry.systems.values()) {
      if (system.detect(rootPath)) {
        return system;
      }
    }
    return null;
  }
}
