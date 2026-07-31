import fs from "fs";
import path from "path";
import type { LanguageParser, Symbol, Reference, Dependency, SearchResult } from "./LanguageParser.js";

export class GoParser implements LanguageParser {
  language = "go";

  findSourceFiles(rootPath: string): string[] {
    const sourceFiles: string[] = [];

    const findFiles = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (![".git", ".mod", "vendor", "bin", "build"].some((skip) => fullPath.includes(skip))) {
              findFiles(fullPath);
            }
          } else if (fullPath.endsWith(".go")) {
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

        // Type definition: type TypeName struct { ... }
        if (trimmed.startsWith("type ") && trimmed.includes("struct")) {
          const match = trimmed.match(/type\s+(\w+)\s+struct/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "class",
              filePath,
              lineNumber,
            });
          }
        }

        // Interface definition: type InterfaceName interface { ... }
        if (trimmed.startsWith("type ") && trimmed.includes("interface")) {
          const match = trimmed.match(/type\s+(\w+)\s+interface/);
          if (match) {
            symbols.push({
              name: match[1],
              type: "interface",
              filePath,
              lineNumber,
            });
          }
        }

        // Function definition: func FunctionName(...) or func (r *Receiver) MethodName(...)
        if (trimmed.startsWith("func ")) {
          let funcName = "";
          let isMethod = false;

          // Check if it's a method (receiver)
          const receiverMatch = trimmed.match(/func\s+\(\s*(\w+)\s+\*?(\w+)\s*\)\s+(\w+)/);
          if (receiverMatch) {
            funcName = receiverMatch[3];
            isMethod = true;
          } else {
            const funcMatch = trimmed.match(/func\s+(\w+)/);
            if (funcMatch) {
              funcName = funcMatch[1];
            }
          }

          if (funcName) {
            // Extract parameters
            const paramSection = trimmed.match(/\(([^)]*)\)/);
            const params = [];
            if (paramSection && paramSection[1]) {
              const paramParts = paramSection[1].split(",");
              for (const param of paramParts) {
                const paramMatch = param.trim().match(/(\w+)\s+(.+?)(?:\s*=\s*[^,]*)?$/);
                if (paramMatch) {
                  params.push({
                    name: paramMatch[1],
                    type: paramMatch[2],
                  });
                }
              }
            }

            symbols.push({
              name: funcName,
              type: isMethod ? "method" : "function",
              filePath,
              lineNumber,
              parameters: params,
            });
          }
        }

        // Const/Var definition: const Name = ... or var Name Type
        if (trimmed.startsWith("const ") || trimmed.startsWith("var ")) {
          const match = trimmed.match(/(?:const|var)\s+(\w+)(?:\s+\w+)?(?:\s*=\s*[^,]+)?/);
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
          if (!line.includes(`func ${symbolName}`) && !line.includes(`type ${symbolName}`)) {
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

      // Extract import statements
      const importRegex = /import\s+(?:"([^"]+)"|`([^`]+)`|\(([^)]+)\))/g;

      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1] || match[2] || match[3];
        if (importPath) {
          dependencies.push({
            name: importPath,
            isExternal: !importPath.startsWith("."),
          });
        }
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
