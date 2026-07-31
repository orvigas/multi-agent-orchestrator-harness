import { ParserRegistry } from "./ParserRegistry.js";
import { TypeScriptParser } from "./TypeScriptParser.js";
import { JavaParser } from "./JavaParser.js";
import { PythonParser } from "./PythonParser.js";
import { GoParser } from "./GoParser.js";
import { RustParser } from "./RustParser.js";
import type { LanguageParser } from "./LanguageParser.js";

export * from "./LanguageParser.js";
export { ParserRegistry } from "./ParserRegistry.js";
export { TypeScriptParser } from "./TypeScriptParser.js";
export { JavaParser } from "./JavaParser.js";
export { PythonParser } from "./PythonParser.js";
export { GoParser } from "./GoParser.js";
export { RustParser } from "./RustParser.js";

// Built-in parsers
const BUILTIN_PARSERS: LanguageParser[] = [
  new TypeScriptParser(),
  new JavaParser(),
  new PythonParser(),
  new GoParser(),
  new RustParser(),
];

export function initializeParsers(): void {
  for (const parser of BUILTIN_PARSERS) {
    ParserRegistry.register(parser);
  }
}
