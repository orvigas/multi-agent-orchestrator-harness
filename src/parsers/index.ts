import { ParserRegistry } from "./ParserRegistry.js";
import { TypeScriptParser } from "./TypeScriptParser.js";
import type { LanguageParser } from "./LanguageParser.js";

export * from "./LanguageParser.js";
export { ParserRegistry } from "./ParserRegistry.js";
export { TypeScriptParser } from "./TypeScriptParser.js";

// Built-in parsers
const BUILTIN_PARSERS: LanguageParser[] = [new TypeScriptParser()];

export function initializeParsers(): void {
  for (const parser of BUILTIN_PARSERS) {
    ParserRegistry.register(parser);
  }
}
