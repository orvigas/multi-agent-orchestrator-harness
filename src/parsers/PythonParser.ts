import fs from "fs";
import path from "path";
import type { LanguageParser, Symbol, Reference, Dependency, SearchResult } from "./LanguageParser.js";

export class PythonParser implements LanguageParser {
  language = "python";

  findSourceFiles(rootPath: string): string[] {
    const sourceFiles: string[] = [];

    const findFiles = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (
              ![".git", "__pycache__", ".venv", "venv", "env", "build", "dist", ".pytest_cache", ".mypy_cache"].some(
                (skip) => fullPath.includes(skip)
              )
            ) {
              findFiles(fullPath);
            }
          } else if (fullPath.endsWith(".py")) {
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
      let inDocstring = false;
      let docstringChar: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (trimmed === "" || trimmed.startsWith("#")) {
          continue;
        }

        // Handle docstrings
        if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
          const quoteChar = trimmed.substring(0, 3);
          if (!inDocstring) {
            inDocstring = true;
            docstringChar = quoteChar;
          } else if (docstringChar === quoteChar) {
            inDocstring = false;
            docstringChar = null;
          }
          continue;
        }

        if (inDocstring) {
          continue;
        }

        // Get indentation level
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;

        // Class definition: class ClassName(...):
        if (trimmed.startsWith("class ")) {
          const classMatch = trimmed.match(/class\s+(\w+)(?:\s*\(([^)]*)\))?:/);
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

        // Function/Method definition: def functionName(...):
        if (trimmed.startsWith("def ")) {
          const funcMatch = trimmed.match(/def\s+(\w+)\s*\(([^)]*)\)/);
          if (funcMatch) {
            const funcName = funcMatch[1];

            // Determine if it's a method (inside a class) or function
            const isMethod = currentClass && indent > 0;

            // Extract parameters
            const paramStr = funcMatch[2];
            const params = paramStr
              .split(",")
              .map((p) => {
                const match = p.trim().match(/(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*[^,]*)?/);
                if (match) {
                  return {
                    name: match[1],
                    type: match[2] ? match[2].trim() : undefined,
                  };
                }
                return null;
              })
              .filter((p) => p && p.name !== "self" && p.name !== "cls");

            symbols.push({
              name: funcName,
              type: isMethod ? "method" : "function",
              filePath,
              lineNumber,
              parameters: params,
            });
          }
        }

        // Update current class if we dedent outside of it
        if (currentClass && indent === 0 && !trimmed.startsWith("class ")) {
          currentClass = null;
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
          // Skip definition lines
          if (!line.includes(`def ${symbolName}`) && !line.includes(`class ${symbolName}`)) {
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
      const lines = content.split("\n");

      for (const line of lines) {
        // import module
        const importMatch = line.match(/^import\s+([\w.]+)(?:\s+as\s+\w+)?/);
        if (importMatch) {
          dependencies.push({
            name: importMatch[1],
            isExternal: !importMatch[1].startsWith("."),
          });
        }

        // from module import something
        const fromMatch = line.match(/^from\s+([\w.]+)\s+import/);
        if (fromMatch) {
          dependencies.push({
            name: fromMatch[1],
            isExternal: !fromMatch[1].startsWith("."),
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
