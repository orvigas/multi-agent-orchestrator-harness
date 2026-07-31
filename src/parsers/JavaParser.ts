import fs from "fs";
import path from "path";
import type { LanguageParser, Symbol, Reference, Dependency, SearchResult, Parameter } from "./LanguageParser.js";

export class JavaParser implements LanguageParser {
  language = "java";

  findSourceFiles(rootPath: string): string[] {
    const sourceFiles: string[] = [];

    const findFiles = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (![".git", "target", ".gradle", "build", "node_modules"].some((skip) => fullPath.includes(skip))) {
              findFiles(fullPath);
            }
          } else if (fullPath.endsWith(".java")) {
            sourceFiles.push(fullPath);
          }
        }
      } catch (err) {
        console.error(`Error reading directory ${dir}:`, err);
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

      let currentClass: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed === "") {
          continue;
        }

        // Class definition: public class ClassName or class ClassName
        if (trimmed.includes("class ") && !trimmed.includes("interface")) {
          const classMatch = trimmed.match(/(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/);
          if (classMatch) {
            currentClass = classMatch[1];
            symbols.push({
              name: currentClass,
              type: "class",
              filePath,
              lineNumber,
            });
          }
        }

        // Interface definition
        if (trimmed.includes("interface ")) {
          const interfaceMatch = trimmed.match(/(?:public\s+)?interface\s+(\w+)/);
          if (interfaceMatch) {
            currentClass = interfaceMatch[1];
            symbols.push({
              name: interfaceMatch[1],
              type: "interface",
              filePath,
              lineNumber,
            });
          }
        }

        // Enum definition
        if (trimmed.includes("enum ")) {
          const enumMatch = trimmed.match(/(?:public\s+)?enum\s+(\w+)/);
          if (enumMatch) {
            symbols.push({
              name: enumMatch[1],
              type: "class",
              filePath,
              lineNumber,
            });
          }
        }

        // Method definition: public void methodName(...) or similar
        if (trimmed.includes("(") && trimmed.includes(")") && !trimmed.includes("class") && !trimmed.includes("interface")) {
          // Match method signatures more flexibly
          const methodMatch = trimmed.match(/\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[^{]*)?(?:\{|;)/);
          if (methodMatch) {
            const methodName = methodMatch[1];

            // Skip constructors (method name same as class name)
            if (currentClass && methodName !== currentClass) {
              // Extract parameters
              const paramSection = trimmed.match(/\(([^)]*)\)/);
              const params: Parameter[] = [];
              if (paramSection && paramSection[1]) {
                const paramParts = paramSection[1].split(",");
                for (const param of paramParts) {
                  const paramMatch = param.trim().match(/(\w+(?:<[^>]+>)?)\s+(\w+)(?:\s*=\s*[^,]*)?$/);
                  if (paramMatch) {
                    params.push({
                      name: paramMatch[2],
                      type: paramMatch[1],
                    });
                  }
                }
              }

              symbols.push({
                name: methodName,
                type: "method",
                filePath,
                lineNumber,
                parameters: params,
              });
            }
          }
        }

        // Field/Variable definition: private String name; or public static final int MAX = 100;
        if (trimmed.endsWith(";") && !trimmed.includes("(") && !trimmed.includes("class") && !trimmed.includes("interface")) {
          const fieldMatch = trimmed.match(/(?:public|private|protected)?\s*(?:static)?\s*(?:final)?\s*(\w+(?:<[^>]+>)?)\s+(\w+)(?:\s*=\s*[^;]*)?;/);
          if (fieldMatch && currentClass) {
            symbols.push({
              name: fieldMatch[2],
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

      // Match word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${symbolName}\\b`, "g");

      lines.forEach((line, i) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
          // Skip the definition line itself
          if (!line.includes("class " + symbolName) && !line.includes("interface " + symbolName)) {
            references.push({
              filePath,
              lineNumber: i + 1,
              context: line.substring(Math.max(0, match.index - 30), Math.min(line.length, match.index + symbolName.length + 30)).trim(),
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
      const importRegex = /import\s+(?:static\s+)?(?:([a-z_][a-z0-9_.]*)\.\*|([a-z_][a-z0-9_.]*));/gi;

      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1] || match[2];
        const isExternal = !importPath.startsWith("com."); // Simplified: external if not com.*

        dependencies.push({
          name: importPath,
          isExternal,
        });
      }

      // Also extract package declaration
      const packageMatch = content.match(/package\s+([a-z_][a-z0-9_.]*);/);
      if (packageMatch) {
        dependencies.push({
          name: packageMatch[1],
          isExternal: false,
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
