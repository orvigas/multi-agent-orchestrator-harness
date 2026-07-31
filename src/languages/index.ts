export * from "./detector.js";

import { initializeParsers } from "../parsers/index.js";
import { initializeValidators } from "../validators/index.js";
import { initializeTestRunners } from "../test-runners/index.js";
import { initializeBuildSystems } from "../build-systems/index.js";

/**
 * Initialize all language support components.
 * Call this once at application startup before processing any code.
 *
 * @example
 * import { initializeLanguageSupport } from "./languages/index.js";
 *
 * // At app startup
 * initializeLanguageSupport();
 *
 * // Now you can use:
 * import { ParserRegistry } from "./parsers/ParserRegistry.js";
 * import { detectLanguages } from "./languages/detector.js";
 *
 * const languages = detectLanguages("/path/to/repo");
 * const parser = ParserRegistry.getParser(languages[0]);
 */
export function initializeLanguageSupport(): void {
  initializeParsers();
  initializeValidators();
  initializeTestRunners();
  initializeBuildSystems();
}
