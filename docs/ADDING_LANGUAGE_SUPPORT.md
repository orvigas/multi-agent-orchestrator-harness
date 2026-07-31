# Adding a New Language to the Harness

**This guide shows how to add support for a new programming language in 3 steps.**

---

## Step 1: Implement the Parser

Create `src/parsers/[Language]Parser.ts`:

```typescript
import fs from "fs";
import path from "path";
import type { LanguageParser, Symbol, Reference, Dependency, SearchResult } from "./LanguageParser.js";

export class JavaParser implements LanguageParser {
  language = "java";

  findSourceFiles(rootPath: string): string[] {
    const sourceFiles: string[] = [];

    const findFiles = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!fullPath.includes("target") && !fullPath.includes(".git")) {
            findFiles(fullPath);
          }
        } else if (fullPath.endsWith(".java")) {
          sourceFiles.push(fullPath);
        }
      }
    };

    findFiles(rootPath);
    return sourceFiles;
  }

  extractSymbols(filePath: string): Symbol[] {
    // Parse Java file and extract classes, methods, interfaces
    // Return array of Symbol objects
    const symbols: Symbol[] = [];

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Simple regex-based extraction for demo
    // Production should use ANTLR or similar
    lines.forEach((line, i) => {
      const classMatch = line.match(/public class (\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: "class",
          filePath,
          lineNumber: i + 1,
        });
      }

      const methodMatch = line.match(/public (?:\w+\s+)+(\w+)\s*\(/);
      if (methodMatch) {
        symbols.push({
          name: methodMatch[1],
          type: "method",
          filePath,
          lineNumber: i + 1,
        });
      }
    });

    return symbols;
  }

  findReferences(filePath: string, symbolName: string): Reference[] {
    // Find all references to a symbol in the file
    const references: Reference[] = [];
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    const regex = new RegExp(`\\b${symbolName}\\b`, "g");

    lines.forEach((line, i) => {
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match.index > 0) {
          // Skip the definition line
          references.push({
            filePath,
            lineNumber: i + 1,
            context: line.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          });
        }
      }
    });

    return references;
  }

  extractDependencies(filePath: string): Dependency[] {
    // Extract import statements
    const dependencies: Dependency[] = [];
    const content = fs.readFileSync(filePath, "utf-8");
    const importRegex = /import\s+(?:static\s+)?(?:[a-z_][a-z0-9_]*\.)*\*?([a-z_][a-z0-9_]*)?;/gi;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push({
        name: match[1] || match[0],
        isExternal: !match[0].includes("com.company"),
      });
    }

    return dependencies;
  }

  searchByPattern(rootPath: string, pattern: string): SearchResult[] {
    // Search for a pattern across all Java files
    const results: SearchResult[] = [];
    const regex = new RegExp(pattern, "g");
    const sourceFiles = this.findSourceFiles(rootPath);

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, i) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
          results.push({
            filePath,
            lineNumber: i + 1,
            matchedText: match[0],
            context: line.substring(Math.max(0, match.index - 20), Math.min(line.length, match.index + match[0].length + 20)),
          });
        }
      });
    }

    return results;
  }
}
```

**Key Methods**:

- `findSourceFiles()` — Find all `.java` files
- `extractSymbols()` — Parse and find classes, methods, interfaces
- `findReferences()` — Find usages of a symbol
- `extractDependencies()` — Parse import statements
- `searchByPattern()` — Regex search across all files

---

## Step 2: Implement the Validator

Create `src/validators/[Language]Validator.ts`:

```typescript
import { spawnSync } from "child_process";
import type { LanguageValidator, ValidationResult, SecurityIssue } from "./LanguageValidator.js";

export class JavaValidator implements LanguageValidator {
  language = "java";

  validateSyntax(filePath: string): ValidationResult {
    // Run javac to check syntax
    const result = spawnSync("javac", ["-d", "/tmp", filePath], {
      encoding: "utf-8",
    });

    const errors = result.stderr
      ? result.stderr.split("\n").map((line) => ({
          file: filePath,
          line: 0,
          message: line,
          severity: "error" as const,
        }))
      : [];

    return {
      passed: result.status === 0,
      errors,
      duration: 1000,
    };
  }

  validateStatic(rootPath: string): ValidationResult {
    // Run checkstyle for static analysis
    const result = spawnSync("checkstyle", ["-c", "/sun_checks.xml", rootPath], {
      encoding: "utf-8",
    });

    const errors = result.stderr
      ? result.stderr.split("\n").map((line) => ({
          file: rootPath,
          line: 0,
          message: line,
          severity: "warning" as const,
        }))
      : [];

    return {
      passed: result.status === 0,
      errors,
      duration: 5000,
    };
  }

  validateSecurity(rootPath: string): SecurityIssue[] {
    // Run security scanner (e.g., OWASP Dependency-Check)
    const result = spawnSync("dependency-check", ["--project", "MyApp", "--scan", rootPath], {
      encoding: "utf-8",
    });

    // Parse output and extract security issues
    return [];
  }
}
```

**Key Methods**:

- `validateSyntax()` — Run compiler (javac)
- `validateStatic()` — Run linter/analyzer (checkstyle)
- `validateSecurity()` — Run security scanner

---

## Step 3: Implement the Test Runner

Create `src/test-runners/[Language]TestRunner.ts`:

```typescript
import { spawnSync } from "child_process";
import type { LanguageTestRunner, TestResult, CoverageReport, TestOptions } from "./LanguageTestRunner.js";

export class JavaTestRunner implements LanguageTestRunner {
  language = "java";

  findTestFiles(rootPath: string): string[] {
    // Find all *Test.java files
    return [];
  }

  runTests(rootPath: string, options?: TestOptions): TestResult {
    // Run maven test
    const result = spawnSync("mvn", ["test"], {
      cwd: rootPath,
      encoding: "utf-8",
    });

    // Parse output (e.g., from Maven Surefire)
    const output = result.stdout || "";

    // Extract test counts
    const passedMatch = output.match(/Tests run: (\d+), Failures: (\d+)/);
    const passed = passedMatch ? parseInt(passedMatch[1]) - parseInt(passedMatch[2]) : 0;
    const failed = passedMatch ? parseInt(passedMatch[2]) : 0;

    return {
      passed,
      failed,
      skipped: 0,
      duration: 30000,
      failures: [],
    };
  }

  getCoverage(rootPath: string): CoverageReport {
    // Run JaCoCo or similar to get coverage
    return {
      lines: 85,
      branches: 72,
      functions: 90,
      statements: 88,
      files: {},
    };
  }
}
```

---

## Step 4: Register the Components

Add to `src/parsers/index.ts`:

```typescript
import { JavaParser } from "./JavaParser.js";

const BUILTIN_PARSERS: LanguageParser[] = [
  new TypeScriptParser(),
  new JavaParser(),  // ← Add here
];
```

Add to `src/validators/index.ts`:

```typescript
import { JavaValidator } from "./JavaValidator.js";

const BUILTIN_VALIDATORS: LanguageValidator[] = [
  new JavaValidator(),  // ← Add here
];
```

Add to `src/test-runners/index.ts`:

```typescript
import { JavaTestRunner } from "./JavaTestRunner.js";

const BUILTIN_TEST_RUNNERS: LanguageTestRunner[] = [
  new JavaTestRunner(),  // ← Add here
];
```

---

## Step 5: Update Configuration

Add to `config/languages.yml`:

```yaml
java:
  name: Java
  fileExtensions: ['.java']
  buildSystems: ['maven', 'gradle']
  validators:
    - type: 'syntax'
      tool: 'javac'
      command: 'javac -d . **/*.java'
    - type: 'lint'
      tool: 'checkstyle'
      command: 'checkstyle -c /sun_checks.xml src/**/*.java'
  testRunners:
    - type: 'unit'
      tool: 'junit'
      command: 'mvn test'
  parser: 'java-tree-sitter'
```

---

## Step 6: Test

Create `src/parsers/JavaParser.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert";
import { JavaParser } from "./JavaParser.js";

test("JavaParser", async (t) => {
  await t.test("should extract classes and methods", () => {
    const parser = new JavaParser();
    const code = `
      public class UserService {
        public void createUser(String name) { }
      }
    `;
    const symbols = parser.extractSymbols(code);

    assert.strictEqual(symbols.length, 2); // class + method
    assert.strictEqual(symbols[0].type, "class");
    assert.strictEqual(symbols[1].type, "method");
  });

  await t.test("should find source files", () => {
    const parser = new JavaParser();
    const files = parser.findSourceFiles("/path/to/java/project");
    // Should find all .java files
  });
});
```

Run tests:

```bash
npm test -- src/parsers/JavaParser.test.ts
```

---

## Minimal Implementation

For a quick proof-of-concept, you can start with a minimal parser:

```typescript
import type { LanguageParser, Symbol } from "./LanguageParser.js";

export class MinimalParser implements LanguageParser {
  language = "minimal";

  findSourceFiles(rootPath: string): string[] {
    return [];
  }

  extractSymbols(filePath: string): Symbol[] {
    return [];
  }

  findReferences(): Reference[] {
    return [];
  }

  extractDependencies(): Dependency[] {
    return [];
  }

  searchByPattern(): SearchResult[] {
    return [];
  }
}
```

Then incrementally add functionality.

---

## Production Considerations

### Use Real Parsers

- **Java**: ANTLR + tree-sitter-java
- **Python**: AST module + tree-sitter-python
- **Go**: tree-sitter-go
- **Rust**: tree-sitter-rust
- **C#**: Roslyn

### Cache Parse Results

Large projects benefit from caching parsed ASTs:

```typescript
export class JavaParserWithCache implements LanguageParser {
  private cache: Map<string, Symbol[]> = new Map();

  extractSymbols(filePath: string): Symbol[] {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    const symbols = this.parseFile(filePath);
    this.cache.set(filePath, symbols);
    return symbols;
  }

  private parseFile(filePath: string): Symbol[] {
    // Actual parsing logic
    return [];
  }
}
```

### Handle Errors Gracefully

```typescript
extractSymbols(filePath: string): Symbol[] {
  try {
    return this.parseFile(filePath);
  } catch (err) {
    console.error(`Failed to parse ${filePath}: ${err}`);
    return [];
  }
}
```

### Timeout on Large Files

```typescript
const symbols = await Promise.race([
  this.parseFile(filePath),
  new Promise((_, reject) => setTimeout(() => reject(new Error("Parse timeout")), 30000)),
]);
```

---

## Common Pitfalls

❌ **Don't** store heavy objects in registries (they'll persist across invocations)

✅ **Do** create fresh instances for each use

---

## Examples

See working implementations:

- **TypeScript**: `src/parsers/TypeScriptParser.ts`
- **Architecture**: `docs/MULTI_LANGUAGE_SUPPORT.md`
- **Full Example**: `docs/POLYGLOT_PROJECT_EXAMPLE.md`

---

## Support

For questions on specific language parsing, check:

- Tree-sitter grammars: https://tree-sitter.github.io/tree-sitter/
- ANTLR grammars: https://github.com/antlr/grammars-v4
- Language AST documentation

