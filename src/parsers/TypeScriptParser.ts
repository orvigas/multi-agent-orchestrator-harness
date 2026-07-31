import { Project, SyntaxKind, ScriptTarget, ModuleKind } from "ts-morph";
import fs from "fs";
import path from "path";
import type { LanguageParser, Symbol, Reference, Dependency, SearchResult, Parameter } from "./LanguageParser.js";

export class TypeScriptParser implements LanguageParser {
  language = "typescript";
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2020,
        module: ModuleKind.ESNext,
      },
    });
  }

  findSourceFiles(rootPath: string): string[] {
    const sourceFiles: string[] = [];
    const extensions = [".ts", ".tsx", ".js", ".jsx"];

    const findFiles = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!fullPath.includes("node_modules") && !fullPath.includes(".git")) {
              findFiles(fullPath);
            }
          } else if (extensions.some((ext) => fullPath.endsWith(ext))) {
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
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      const statements = sourceFile.getStatements();

      for (const statement of statements) {
        if (statement.getKind() === SyntaxKind.FunctionDeclaration) {
          const func = statement.asKind(SyntaxKind.FunctionDeclaration);
          if (func) {
            const params = func.getParameters().map((p) => ({
              name: p.getName(),
              type: p.getTypeNode()?.getText(),
              isOptional: p.isOptional(),
            }));

            symbols.push({
              name: func.getName() || "unnamed",
              type: "function",
              filePath,
              lineNumber: sourceFile.getLineAndColumnAtPosition(func.getStart()).line,
              docstring: func.getJsDocs()[0]?.getText(),
              parameters: params,
            });
          }
        } else if (statement.getKind() === SyntaxKind.ClassDeclaration) {
          const cls = statement.asKind(SyntaxKind.ClassDeclaration);
          if (cls) {
            symbols.push({
              name: cls.getName() || "unnamed",
              type: "class",
              filePath,
              lineNumber: sourceFile.getLineAndColumnAtPosition(cls.getStart()).line,
              docstring: cls.getJsDocs()[0]?.getText(),
            });

            // Extract class methods
            for (const method of cls.getMethods()) {
              const params = method.getParameters().map((p) => ({
                name: p.getName(),
                type: p.getTypeNode()?.getText(),
                isOptional: p.isOptional(),
              }));

              symbols.push({
                name: method.getName(),
                type: "method",
                filePath,
                lineNumber: sourceFile.getLineAndColumnAtPosition(method.getStart()).line,
                docstring: method.getJsDocs()[0]?.getText(),
                parameters: params,
              });
            }
          }
        } else if (statement.getKind() === SyntaxKind.InterfaceDeclaration) {
          const iface = statement.asKind(SyntaxKind.InterfaceDeclaration);
          if (iface) {
            symbols.push({
              name: iface.getName(),
              type: "interface",
              filePath,
              lineNumber: sourceFile.getLineAndColumnAtPosition(iface.getStart()).line,
              docstring: iface.getJsDocs()[0]?.getText(),
            });
          }
        } else if (statement.getKind() === SyntaxKind.TypeAliasDeclaration) {
          const typeAlias = statement.asKind(SyntaxKind.TypeAliasDeclaration);
          if (typeAlias) {
            symbols.push({
              name: typeAlias.getName(),
              type: "type",
              filePath,
              lineNumber: sourceFile.getLineAndColumnAtPosition(typeAlias.getStart()).line,
              docstring: typeAlias.getJsDocs()[0]?.getText(),
            });
          }
        } else if (statement.getKind() === SyntaxKind.VariableStatement) {
          const varStmt = statement.asKind(SyntaxKind.VariableStatement);
          if (varStmt) {
            for (const decl of varStmt.getDeclarations()) {
              symbols.push({
                name: decl.getName(),
                type: decl.getInitializer()?.getKind() === SyntaxKind.ArrowFunction ? "const" : "variable",
                filePath,
                lineNumber: sourceFile.getLineAndColumnAtPosition(decl.getStart()).line,
              });
            }
          }
        }
      }

      this.project.removeSourceFile(sourceFile);
    } catch (err) {
      console.error(`Error extracting symbols from ${filePath}:`, err);
    }

    return symbols;
  }

  findReferences(filePath: string, symbolName: string): Reference[] {
    const references: Reference[] = [];

    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      const symbol = sourceFile.exportedDeclarations?.get(symbolName);

      if (symbol && symbol.length > 0) {
        const declaration = symbol[0];
        const refs = declaration.getReferencesAsNodes();

        for (const ref of refs) {
          references.push({
            filePath: ref.getSourceFile().getFilePath(),
            lineNumber: ref.getSourceFile().getLineAndColumnAtPosition(ref.getStart()).line,
            context: ref.getText().substring(0, 80),
          });
        }
      }

      this.project.removeSourceFile(sourceFile);
    } catch (err) {
      console.error(`Error finding references to ${symbolName}:`, err);
    }

    return references;
  }

  extractDependencies(filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];

    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      const imports = sourceFile.getImportDeclarations();

      for (const imp of imports) {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        const isExternal = !moduleSpecifier.startsWith(".");

        dependencies.push({
          name: moduleSpecifier,
          isExternal,
          filePath: !isExternal ? path.resolve(path.dirname(filePath), moduleSpecifier) : undefined,
        });
      }

      this.project.removeSourceFile(sourceFile);
    } catch (err) {
      console.error(`Error extracting dependencies from ${filePath}:`, err);
    }

    return dependencies;
  }

  searchByPattern(rootPath: string, pattern: string): SearchResult[] {
    const results: SearchResult[] = [];
    const regex = new RegExp(pattern, "g");

    const sourceFiles = this.findSourceFiles(rootPath);

    for (const filePath of sourceFiles) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          let match;
          while ((match = regex.exec(lines[i])) !== null) {
            results.push({
              filePath,
              lineNumber: i + 1,
              matchedText: match[0],
              context: lines[i].substring(Math.max(0, match.index - 20), Math.min(lines[i].length, match.index + match[0].length + 20)),
            });
          }
        }
      } catch (err) {
        console.error(`Error searching in ${filePath}:`, err);
      }
    }

    return results;
  }
}
