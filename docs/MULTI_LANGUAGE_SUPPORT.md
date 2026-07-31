# Multi-Language Support Architecture

**Branch**: `feature/multi-language-support`  
**Status**: Architectural Foundation  
**Goal**: Enable harness to work with any programming language

---

## Problem Statement

Current harness:
- ✅ Works perfectly for TypeScript/JavaScript
- ❌ Cannot analyze Java, Python, Go, Rust, etc.
- ❌ Hard-coded to `ts-morph` AST parser
- ❌ Assumes TypeScript validation (tsc)
- ❌ Assumes JavaScript testing (Jest/npm test)

**Solution**: Language-agnostic architecture with pluggable parsers, validators, and test runners.

---

## Architecture Overview

```
┌─ Knowledge Engine ──────────────────┐
│  src/parsers/                       │
│  ├─ LanguageParser (interface)      │
│  │  ├─ TypeScriptParser             │
│  │  ├─ JavaParser                   │
│  │  ├─ PythonParser                 │
│  │  ├─ GoParser                     │
│  │  └─ RustParser                   │
│  │                                  │
│  └─ ParserRegistry                  │
│     └─ Autodetect language          │
│     └─ Route to correct parser      │
│                                    │
├─ Validation Pipeline ──────────────┐
│  src/validators/                    │
│  ├─ LanguageValidator (interface)   │
│  │  ├─ TypeScriptValidator (tsc)    │
│  │  ├─ JavaValidator (javac)        │
│  │  ├─ PythonValidator (mypy/flake8)│
│  │  ├─ GoValidator (go vet)         │
│  │  └─ RustValidator (cargo check)  │
│  │                                  │
│  └─ ValidatorRegistry               │
│     └─ Route by language            │
│                                    │
├─ Test Runners ─────────────────────┐
│  src/test-runners/                  │
│  ├─ LanguageTestRunner (interface)  │
│  │  ├─ TypeScriptTestRunner (Jest)  │
│  │  ├─ JavaTestRunner (JUnit/Maven) │
│  │  ├─ PythonTestRunner (pytest)    │
│  │  ├─ GoTestRunner (go test)       │
│  │  └─ RustTestRunner (cargo test)  │
│  │                                  │
│  └─ TestRunnerRegistry              │
│     └─ Route by language            │
│                                    │
└─ Build Systems ────────────────────┐
   src/build-systems/                 │
   ├─ BuildSystem (interface)         │
   │  ├─ NPM (Node.js)                │
   │  ├─ Maven/Gradle (Java)          │
   │  ├─ Pip/Poetry (Python)          │
   │  ├─ Cargo (Rust)                 │
   │  └─ Go Modules                   │
   │                                  │
   └─ BuildRegistry                   │
      └─ Detect build system          │
```

---

## Core Abstractions

### 1. Language Parser Interface

```typescript
// src/parsers/LanguageParser.ts

export interface LanguageParser {
  language: string;  // "typescript", "java", "python", etc.
  
  /**
   * Find all files of this language in a directory
   */
  findSourceFiles(rootPath: string): string[];
  
  /**
   * Extract symbols (functions, classes, etc.) from a file
   */
  extractSymbols(filePath: string): Symbol[];
  
  /**
   * Find all references to a symbol
   */
  findReferences(filePath: string, symbolName: string): Reference[];
  
  /**
   * Extract import/dependency information
   */
  extractDependencies(filePath: string): Dependency[];
  
  /**
   * Search code by pattern (e.g., regex, AST query)
   */
  searchByPattern(rootPath: string, pattern: string): SearchResult[];
}

interface Symbol {
  name: string;
  type: "function" | "class" | "method" | "variable" | "interface";
  filePath: string;
  lineNumber: number;
  docstring?: string;
  parameters?: Parameter[];
}

interface Reference {
  filePath: string;
  lineNumber: number;
  context: string;
}

interface Dependency {
  name: string;
  version?: string;
  isExternal: boolean;
}
```

### 2. Language Validator Interface

```typescript
// src/validators/LanguageValidator.ts

export interface LanguageValidator {
  language: string;
  
  /**
   * Validate code compiles/is syntactically correct
   */
  validateSyntax(filePath: string): ValidationResult;
  
  /**
   * Run static analysis/linting
   */
  validateStatic(rootPath: string): ValidationResult[];
  
  /**
   * Run security checks
   */
  validateSecurity(rootPath: string): SecurityIssue[];
}

interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
}
```

### 3. Language Test Runner Interface

```typescript
// src/test-runners/LanguageTestRunner.ts

export interface LanguageTestRunner {
  language: string;
  
  /**
   * Detect test files for this language
   */
  findTestFiles(rootPath: string): string[];
  
  /**
   * Run tests and return results
   */
  runTests(rootPath: string, options?: TestOptions): TestResult;
  
  /**
   * Extract code coverage
   */
  getCoverage(rootPath: string): CoverageReport;
}

interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
}

interface TestFailure {
  file: string;
  testName: string;
  message: string;
  stackTrace: string;
}
```

### 4. Build System Interface

```typescript
// src/build-systems/BuildSystem.ts

export interface BuildSystem {
  name: string;  // "npm", "maven", "pip", "cargo", "go"
  
  /**
   * Detect if this build system is being used
   */
  detect(rootPath: string): boolean;
  
  /**
   * Install dependencies
   */
  install(rootPath: string): void;
  
  /**
   * Run build command
   */
  build(rootPath: string): BuildResult;
  
  /**
   * Get build output directory
   */
  getOutputDir(rootPath: string): string;
}
```

---

## Implementation Roadmap

### Phase 1: Architecture & TypeScript (Week 1)

- [x] Create parser interfaces
- [x] Create validator interfaces  
- [x] Create test runner interfaces
- [ ] Refactor current TypeScript parser to use interface
- [ ] Refactor current validators
- [ ] Refactor current test runners
- [ ] Create ParserRegistry

### Phase 2: Language Support (Weeks 2-4)

#### Python Support
- [ ] Create PythonParser (AST module)
- [ ] Create PythonValidator (mypy + flake8)
- [ ] Create PythonTestRunner (pytest)
- [ ] Python build system detection

#### Java Support
- [ ] Create JavaParser (ANTLR or Tree-sitter)
- [ ] Create JavaValidator (javac + findbugs)
- [ ] Create JavaTestRunner (JUnit + Maven)
- [ ] Java build system detection

#### Go Support
- [ ] Create GoParser (Tree-sitter)
- [ ] Create GoValidator (go vet + golangci-lint)
- [ ] Create GoTestRunner (go test)

#### Rust Support
- [ ] Create RustParser (Tree-sitter)
- [ ] Create RustValidator (cargo check + clippy)
- [ ] Create RustTestRunner (cargo test)

### Phase 3: Integration (Week 5)

- [ ] Update Knowledge Engine to detect language
- [ ] Update Implementation Loop to use language-specific tools
- [ ] Update Validation Pipeline
- [ ] End-to-end tests

---

## Language Detection Strategy

```typescript
// src/languages/detector.ts

export function detectLanguage(rootPath: string): string[] {
  const detectedLanguages: Set<string> = new Set();
  
  // Check for language-specific file extensions
  const files = fs.readdirSync(rootPath, { recursive: true });
  
  for (const file of files) {
    const ext = path.extname(file);
    
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      detectedLanguages.add('typescript');
    } else if (['.java'].includes(ext)) {
      detectedLanguages.add('java');
    } else if (['.py'].includes(ext)) {
      detectedLanguages.add('python');
    } else if (['.go'].includes(ext)) {
      detectedLanguages.add('go');
    } else if (['.rs'].includes(ext)) {
      detectedLanguages.add('rust');
    }
  }
  
  // Check for build system files
  if (fs.existsSync(path.join(rootPath, 'package.json'))) {
    detectedLanguages.add('typescript'); // or javascript
  }
  if (fs.existsSync(path.join(rootPath, 'pom.xml'))) {
    detectedLanguages.add('java');
  }
  if (fs.existsSync(path.join(rootPath, 'requirements.txt'))) {
    detectedLanguages.add('python');
  }
  if (fs.existsSync(path.join(rootPath, 'go.mod'))) {
    detectedLanguages.add('go');
  }
  if (fs.existsSync(path.join(rootPath, 'Cargo.toml'))) {
    detectedLanguages.add('rust');
  }
  
  return Array.from(detectedLanguages);
}
```

---

## Parser Registry Pattern

```typescript
// src/parsers/ParserRegistry.ts

export class ParserRegistry {
  private static parsers: Map<string, LanguageParser> = new Map();
  
  static {
    // Register built-in parsers
    ParserRegistry.register(new TypeScriptParser());
    ParserRegistry.register(new JavaParser());
    ParserRegistry.register(new PythonParser());
    ParserRegistry.register(new GoParser());
    ParserRegistry.register(new RustParser());
  }
  
  static register(parser: LanguageParser) {
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
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'typescript',
      '.jsx': 'typescript',
      '.java': 'java',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
    };
    
    const language = extMap[ext];
    if (!language) {
      throw new Error(`Unknown file type: ${ext}`);
    }
    
    return ParserRegistry.getParser(language);
  }
}
```

---

## Multi-Language Project Example

```bash
# Project structure
my-polyglot-app/
├─ backend/
│  ├─ api/
│  │  ├─ pom.xml (Java + Maven)
│  │  └─ src/main/java/**/*.java
│  │
│  └─ worker/
│     ├─ go.mod (Go)
│     └─ *.go
│
├─ frontend/
│  ├─ package.json (TypeScript + npm)
│  └─ src/**/*.{ts,tsx}
│
└─ scripts/
   ├─ requirements.txt (Python)
   └─ *.py
```

Running harness:
```bash
# Automatically detects: Java, Go, TypeScript, Python
HARNESS_MODE=llm npm run dev -- --target /path/to/polyglot-app

# Harness will:
# 1. Detect all 4 languages
# 2. Route each ticket to appropriate parser
# 3. Validate with language-specific tools
# 4. Run language-specific tests
# 5. Generate language-appropriate code
```

---

## Tree-Sitter Integration (Recommended)

For language-agnostic AST parsing:

```typescript
// src/parsers/TreeSitterParser.ts

import Parser from "web-tree-sitter";

export class TreeSitterParser implements LanguageParser {
  private parser: Parser;
  private language: string;
  
  async initialize(language: string) {
    await Parser.init();
    const lang = await Parser.Language.load(`tree-sitter-${language}.wasm`);
    this.parser = new Parser();
    this.parser.setLanguage(lang);
    this.language = language;
  }
  
  extractSymbols(code: string): Symbol[] {
    const tree = this.parser.parse(code);
    // Traverse tree and extract symbols
    // Works for any language with Tree-sitter grammar
    return this.traverseTree(tree.rootNode);
  }
  
  private traverseTree(node: Parser.SyntaxNode): Symbol[] {
    const symbols: Symbol[] = [];
    
    // Pattern: look for function/class definitions
    // Tree-sitter provides consistent node types across languages
    if (this.isFunctionDef(node) || this.isClassDef(node)) {
      symbols.push({
        name: node.child(0)?.text || "unnamed",
        type: this.isFunctionDef(node) ? "function" : "class",
        lineNumber: node.startPosition.row,
        filePath: "", // Set by caller
      });
    }
    
    // Recurse to children
    for (let child of node.children) {
      symbols.push(...this.traverseTree(child));
    }
    
    return symbols;
  }
  
  private isFunctionDef(node: Parser.SyntaxNode): boolean {
    // Language-specific: check node type
    const funcTypes = [
      'function_declaration',
      'method_definition', 
      'function_item',      // Rust
      'func_decl',          // Go
      'method_declaration', // Java
      'function_def',       // Python
    ];
    return funcTypes.includes(node.type);
  }
}
```

---

## Configuration: Supported Languages

```yaml
# config/languages.yml

supportedLanguages:
  typescript:
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx']
    buildSystem: npm
    parser: typescript
    validator: typescript
    testRunner: jest
    
  java:
    fileExtensions: ['.java']
    buildSystem: maven
    parser: tree-sitter-java
    validator: javac
    testRunner: junit
    
  python:
    fileExtensions: ['.py']
    buildSystem: pip
    parser: python-ast
    validator: mypy
    testRunner: pytest
    
  go:
    fileExtensions: ['.go']
    buildSystem: go-modules
    parser: tree-sitter-go
    validator: go-vet
    testRunner: go-test
    
  rust:
    fileExtensions: ['.rs']
    buildSystem: cargo
    parser: tree-sitter-rust
    validator: cargo-check
    testRunner: cargo-test
```

---

## Migration Path from Current TypeScript-Only

### Step 1: Extract TypeScript Parser
```bash
# Move existing parser to interface
src/parsers/TypeScriptParser.ts (implements LanguageParser)
```

### Step 2: Create Registries
```bash
src/parsers/ParserRegistry.ts
src/validators/ValidatorRegistry.ts
src/test-runners/TestRunnerRegistry.ts
```

### Step 3: Update Knowledge Engine
```bash
# Instead of: new TypeScriptParser()
# Use: ParserRegistry.getParser(language)
src/workflows/knowledge-engine/nodes/evidence.ts
```

### Step 4: Add New Languages
```bash
# One at a time
src/parsers/JavaParser.ts
src/validators/JavaValidator.ts
src/test-runners/JavaTestRunner.ts
# ... repeat for Python, Go, Rust
```

---

## Testing Strategy

Each parser/validator/test-runner gets:

```typescript
// src/parsers/TypeScriptParser.test.ts

describe('TypeScriptParser', () => {
  it('should extract functions and classes', () => {
    const code = `
      export function greet(name: string) { }
      export class User { }
    `;
    const parser = new TypeScriptParser();
    const symbols = parser.extractSymbols(code);
    expect(symbols).toHaveLength(2);
  });
  
  it('should find references to symbols', () => {
    const parser = new TypeScriptParser();
    const refs = parser.findReferences(filePath, 'greet');
    expect(refs.length).toBeGreaterThan(0);
  });
});
```

---

## Benefits

✅ **Single Harness, Any Language**
- One knowledge engine for Java, Python, Go, Rust, etc.
- No separate harness per language

✅ **Polyglot Projects**
- Run harness on mixed-language projects
- Detect and route automatically

✅ **Extensible**
- Add new language = implement 3 interfaces
- No core changes needed

✅ **Testable**
- Each language isolated in its own module
- Can test independently

✅ **Production-Ready**
- Uses proven parsers (Tree-sitter, AST modules)
- Real validators and test runners
- Not a PoC

---

## Phase 1 Deliverables (This Branch)

- [x] Architecture documentation
- [ ] Language parser interface + TypeScript implementation
- [ ] Validator interface + TypeScript implementation
- [ ] Test runner interface + TypeScript implementation
- [ ] ParserRegistry + auto-detection
- [ ] Unit tests for each component
- [ ] Example: Using with polyglot project

---

## References

- **Tree-sitter**: https://tree-sitter.github.io/tree-sitter/ (language-agnostic AST parsing)
- **ANTLR**: https://www.antlr.org/ (alternative parser generator)
- **Language implementations**: See `src/parsers/` for each language's documentation

---

**Ready to build a truly language-agnostic harness.**
