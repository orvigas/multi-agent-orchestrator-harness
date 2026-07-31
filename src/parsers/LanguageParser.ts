export interface Symbol {
  name: string;
  type: "function" | "class" | "method" | "variable" | "interface" | "type" | "const";
  filePath: string;
  lineNumber: number;
  docstring?: string;
  parameters?: Parameter[];
}

export interface Parameter {
  name: string;
  type?: string;
  isOptional?: boolean;
}

export interface Reference {
  filePath: string;
  lineNumber: number;
  context: string;
}

export interface Dependency {
  name: string;
  version?: string;
  isExternal: boolean;
  filePath?: string;
}

export interface SearchResult {
  filePath: string;
  lineNumber: number;
  matchedText: string;
  context: string;
}

export interface LanguageParser {
  language: string;

  /**
   * Find all source files of this language in a directory.
   */
  findSourceFiles(rootPath: string): string[];

  /**
   * Extract symbols (functions, classes, etc.) from a file.
   */
  extractSymbols(filePath: string): Symbol[];

  /**
   * Find all references to a symbol.
   */
  findReferences(filePath: string, symbolName: string): Reference[];

  /**
   * Extract import/dependency information.
   */
  extractDependencies(filePath: string): Dependency[];

  /**
   * Search code by pattern (regex).
   */
  searchByPattern(rootPath: string, pattern: string): SearchResult[];
}
