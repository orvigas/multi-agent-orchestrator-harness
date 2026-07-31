import fs from "fs";
import path from "path";
import type { LanguageParser, Symbol, Reference, Dependency, SearchResult } from "./LanguageParser.js";

export class RustParser implements LanguageParser {
  language = "rust";

  findSourceFiles(rootPath: string): string[] {
    const sourceFiles: string[] = [];

    const findFiles = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (![".git", "target", ".cargo"].some((skip) => fullPath.includes(skip))) {
              findFiles(fullPath);
            }
          } else if (fullPath.endsWith(".rs")) {
            sourceFiles.push(fullPath);
          }
        }
      } catch (err) {
        // Ignore read errors
      }
    };

    findFiles(rootPath);
    return sourceFiles;
  }

  extractSymbols(filePath: string): Symbol[] {
    const symbols: Symbol[] = [];

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (trimmed === "" || trimmed.startsWith("//")) {
          continue;
        }

        // Struct definition: pub struct StructName { ... }
        if (trimmed.includes("struct ") && !trimmed.includes("(")) {
          const match = trimmed.match(/(?:pub\s+)?struct\s+(\w+)/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "class",
              filePath,
              lineNumber,
            });
          }
        }

        // Tuple struct: pub struct Name(Type);
        if (trimmed.includes("struct ") && trimmed.includes("(")) {
          const match = trimmed.match(/(?:pub\s+)?struct\s+(\w+)\s*\(/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "class",
              filePath,
              lineNumber,
            });
          }
        }

        // Enum definition: pub enum EnumName { ... }
        if (trimmed.includes("enum ")) {
          const match = trimmed.match(/(?:pub\s+)?enum\s+(\w+)/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "class",
              filePath,
              lineNumber,
            });
          }
        }

        // Trait definition: pub trait TraitName { ... }
        if (trimmed.includes("trait ")) {
          const match = trimmed.match(/(?:pub\s+)?trait\s+(\w+)/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "interface",
              filePath,
              lineNumber,
            });
          }
        }

        // Function definition: pub fn function_name(...)
        if (trimmed.startsWith("fn ") || trimmed.startsWith("pub fn ")) {
          const match = trimmed.match(/(?:pub\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)/);
          if (match) {
            // Extract parameters
            const paramSection = trimmed.match(/\(([^)]*)\)/);
            const params = [];
            if (paramSection && paramSection[1]) {
              const paramParts = paramSection[1].split(",");
              for (const param of paramParts) {
                const paramMatch = param.trim().match(/(\w+)\s*:\s*([^=]+?)(?:\s*=\s*[^,]*)?$/);
                if (paramMatch) {
                  params.push({
                    name: paramMatch[1],
                    type: paramMatch[2].trim(),
                  });
                }
              }
            }

            symbols.push({
              name: match[1],
              type: "function",
              filePath,
              lineNumber,
              parameters: params,
            });
          }
        }

        // Impl block methods: impl StructName { fn method(...) }
        if (trimmed.includes("impl ") && !trimmed.includes("fn")) {
          const match = trimmed.match(/impl\s+(?:<[^>]+>)?\s*(\w+)/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "class",
              filePath,
              lineNumber,
            });
          }
        }

        // Const definition: pub const NAME: Type = value;
        if (trimmed.startsWith("const ") || trimmed.startsWith("pub const ")) {
          const match = trimmed.match(/(?:pub\s+)?const\s+(\w+)\s*:/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "variable",
              filePath,
              lineNumber,
            });
          }
        }

        // Static definition: pub static NAME: Type = value;
        if (trimmed.startsWith("static ") || trimmed.startsWith("pub static ")) {
          const match = trimmed.match(/(?:pub\s+)?static\s+(\w+)\s*:/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "variable",
              filePath,
              lineNumber,
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error extracting symbols from ${filePath}:`, err);
    }

    return symbols;
  }

  findReferences(filePath: string, symbolName: string): Reference[] {
    const references: Reference[] = [];

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const regex = new RegExp(`\\b${symbolName}\\b`, "g");

      lines.forEach((line, i) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
          if (!line.includes(`struct ${symbolName}`) && !line.includes(`enum ${symbolName}`) && !line.includes(`trait ${symbolName}`)) {
            references.push({
              filePath,
              lineNumber: i + 1,
              context: line
                .substring(Math.max(0, match.index - 30), Math.min(line.length, match.index + symbolName.length + 30))
                .trim(),
            });
          }
        }
      });
    } catch (err) {
      console.error(`Error finding references to ${symbolName}:`, err);
    }

    return references;
  }

  extractDependencies(filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];

    try {
      const content = fs.readFileSync(filePath, "utf-8");

      // Extract use statements
      const useRegex = /use\s+(?:crate::)?([^;{]+)/g;

      let match;
      while ((match = useRegex.exec(content)) !== null) {
        dependencies.push({
          name: match[1].trim(),
          isExternal: !match[1].includes("crate::"),
        });
      }
    } catch (err) {
      console.error(`Error extracting dependencies from ${filePath}:`, err);
    }

    return dependencies;
  }

  searchByPattern(rootPath: string, pattern: string): SearchResult[] {
    const results: SearchResult[] = [];

    try {
      const regex = new RegExp(pattern, "g");
      const sourceFiles = this.findSourceFiles(rootPath);

      for (const filePath of sourceFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n");

          lines.forEach((line, i) => {
            let match;
            while ((match = regex.exec(line)) !== null) {
              results.push({
                filePath,
                lineNumber: i + 1,
                matchedText: match[0],
                context: line
                  .substring(Math.max(0, match.index - 40), Math.min(line.length, match.index + match[0].length + 40))
                  .trim(),
              });
            }
          });
        } catch (err) {
          // Skip files that can't be read
        }
      }
    } catch (err) {
      console.error(`Error searching for pattern in ${rootPath}:`, err);
    }

    return results;
  }
}
