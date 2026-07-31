import path from "path";
import type { LanguageParser } from "./LanguageParser.js";

export class ParserRegistry {
  private static parsers: Map<string, LanguageParser> = new Map();

  static register(parser: LanguageParser): void {
    ParserRegistry.parsers.set(parser.language, parser);
  }

  static getParser(language: string): LanguageParser {
    const parser = ParserRegistry.parsers.get(language);
    if (!parser) {
      throw new Error(`No parser found for language: ${language}`);
    }
    return parser;
  }

  static getParserForFile(filePath: string): LanguageParser {
    const ext = path.extname(filePath).toLowerCase();

    const extMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "typescript",
      ".jsx": "typescript",
      ".java": "java",
      ".py": "python",
      ".go": "go",
      ".rs": "rust",
    };

    const language = extMap[ext];
    if (!language) {
      throw new Error(`Unknown file type: ${ext}`);
    }

    return ParserRegistry.getParser(language);
  }

  static hasParser(language: string): boolean {
    return ParserRegistry.parsers.has(language);
  }

  static supportedLanguages(): string[] {
    return Array.from(ParserRegistry.parsers.keys());
  }
}
