# Polyglot Project Example

**Goal**: Demonstrate multi-language support with a real-world polyglot project.

---

## Project Structure

```
my-company-platform/
├── backend/
│   ├── api/
│   │   ├── pom.xml              ← Java + Maven
│   │   ├── src/main/java/
│   │   │   └── com/company/api/
│   │   │       ├── UserService.java
│   │   │       ├── AuthController.java
│   │   │       └── UserService.test.java
│   │   └── src/test/java/
│   │
│   ├── worker/
│   │   ├── go.mod               ← Go
│   │   ├── go.sum
│   │   ├── main.go
│   │   ├── worker/
│   │   │   ├── processor.go
│   │   │   └── processor_test.go
│   │   └── Makefile
│   │
│   └── cli/
│       ├── Cargo.toml           ← Rust
│       ├── src/
│       │   ├── main.rs
│       │   └── lib.rs
│       └── tests/
│
├── frontend/
│   ├── package.json             ← TypeScript/Node.js
│   ├── src/
│   │   ├── components/
│   │   │   └── UserForm.tsx
│   │   └── services/
│   │       └── api.ts
│   ├── tests/
│   └── tsconfig.json
│
├── scripts/
│   ├── requirements.txt          ← Python
│   ├── deploy.py
│   ├── data_migration.py
│   └── tests/
│
└── README.md
```

---

## Language Detection

Running the harness on this project:

```bash
npm run dev -- --target /path/to/my-company-platform
```

**Harness automatically detects**:

```
Languages: [typescript, java, go, rust, python]
Build Systems: [npm, maven, go-modules, cargo, pip]
Project Type: Polyglot Monorepo
```

---

## Per-Language Analysis Example

### Ticket: "Add email verification for user registration"

The orchestrator processes this ticket across all languages:

#### 1. **Knowledge Engine** (Language-Aware Evidence Retrieval)

```
TypeScript Evidence:
  - frontend/src/components/UserForm.tsx (email input field)
  - frontend/src/services/api.ts (registration API call)
  - frontend/tests/UserForm.test.tsx (existing tests)

Java Evidence:
  - backend/api/src/main/java/com/company/api/UserService.java (user creation)
  - backend/api/src/main/java/com/company/api/AuthController.java (registration endpoint)
  - backend/api/src/test/java/UserServiceTest.java (test patterns)

Python Evidence:
  - scripts/data_migration.py (user data scripts)
  - Not in scope for this ticket (scripts are deployment-only)
```

#### 2. **Planner** (Multi-Language Task Ordering)

```
Discovery:
  Problems:
    - Email field exists but not validated
    - Backend accepts any email format
    - No verification email sent

Dependencies:
  - frontend/src/components/UserForm.tsx depends on frontend/src/services/api.ts
  - frontend/src/services/api.ts calls backend/api (AuthController)
  - backend/api/UserService.java stores user

Plan:
  task-1: Frontend - Add email validation regex (TypeScript)
  task-2: Backend - Add email verification service (Java)
  task-3: Frontend - Add verification UI (TypeScript)
  task-4: Integration tests (both TypeScript + Java)
```

#### 3. **Implementation** (Language-Specific Patch Generation)

For each task, LLM generates language-appropriate patches:

**Task-1 (TypeScript)**:
```typescript
// frontend/src/components/UserForm.tsx
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const handleSubmit = (data: FormData) => {
  if (!validateEmail(data.email)) {
    setError('Invalid email format');
    return;
  }
  // ... rest of submission
};
```

**Task-2 (Java)**:
```java
// backend/api/src/main/java/com/company/api/EmailVerificationService.java
public class EmailVerificationService {
  public void sendVerificationEmail(User user, String token) {
    // Generate verification token
    // Send email via SMTP
  }
  
  public boolean verifyToken(String email, String token) {
    // Check token validity
  }
}
```

#### 4. **Validation Pipeline** (Per-Language Tools)

**TypeScript Validation**:
```bash
✓ tsc --noEmit          # Type checking
✓ eslint .              # Linting
✓ npm test              # Unit tests
✓ npm run coverage      # Coverage report
```

**Java Validation**:
```bash
✓ mvn compile           # Compilation
✓ mvn checkstyle:check  # Code style
✓ mvn test              # Unit tests
✓ mvn verify            # Integration tests
```

**Result**: All 4 languages validated. No conflicts.

#### 5. **Recovery** (If Validation Fails)

If Java compilation fails:
```
Error: Cannot find symbol: class User

Diagnosis:
  - Root cause: USER_ENTITY_NOT_FOUND (missing import)
  - Severity: Critical

Strategy:
  - Import the User entity from correct package
  - Retry compilation
```

---

## Configuration: Per-Language Setup

### `.env` for Polyglot

```bash
# TypeScript/Node.js
NODE_ENV=production
NPM_TOKEN=npm_xxxx

# Java/Maven
JAVA_HOME=/usr/lib/jvm/java-17-openjdk
MAVEN_OPTS=-Xmx2g

# Go
GOPATH=/home/user/go
GOPRIVATE=github.com/my-company/*

# Rust
RUST_BACKTRACE=1
CARGO_NET_OFFLINE=false

# Python
PYTHONPATH=./scripts

# Harness
HARNESS_MODE=llm
ANTHROPIC_API_KEY=sk-ant-v0-...
```

### Per-Language Timeout Budgets

```yaml
# config/providers.yml
roles:
  discoveryNode:
    provider: anthropic
    model: claude-opus-5
    timeout: 60000
    maxTokens: 3000
    instructions: |
      IMPORTANT: When analyzing polyglot repos, find evidence from ALL relevant languages.
      For a ticket on "email verification", search:
        - TypeScript: frontend validation, API calls
        - Java: backend validation, email service
        - Python: data migration scripts that might affect users

  implementer:
    provider: anthropic
    model: claude-opus-5
    timeout: 45000
    maxTokens: 4000
    instructions: |
      Generate patches in the same language as the file being modified.
      CRITICAL: Match the code style and patterns of each language.
      - For .ts files: Use TypeScript strict mode, async/await
      - For .java files: Follow Java naming conventions, use Spring patterns
      - For .go files: Use idiomatic Go, check for errors
      - For .rs files: Use Rust ownership model, handle Result<T>
```

---

## Multi-Language Test Execution

```bash
npm run dev -- --target /path/to/my-company-platform

# Harness runs validation stages in parallel:

Compile Stage:
  ├─ TypeScript: tsc --noEmit        → ✓ (0 errors)
  ├─ Java: mvn compile               → ✓ (0 errors)
  ├─ Go: go build ./...              → ✓ (0 errors)
  ├─ Rust: cargo check               → ✓ (0 errors)
  └─ Python: python -m py_compile    → ✓ (0 errors)

Test Stage:
  ├─ TypeScript: npm test            → ✓ (125 passed)
  ├─ Java: mvn test                  → ✓ (87 passed)
  ├─ Go: go test ./...               → ✓ (34 passed)
  ├─ Rust: cargo test                → ✓ (12 passed)
  └─ Python: pytest                  → ✓ (8 passed)

Lint Stage (Parallel):
  ├─ TypeScript: eslint .            → ✓ (0 warnings)
  ├─ Java: checkstyle                → ✓ (0 warnings)
  ├─ Go: golangci-lint               → ✓ (0 warnings)
  └─ Rust: cargo clippy              → ✓ (0 warnings)

Result: ✅ ALL VALIDATIONS PASSED
```

---

## Benefits of Multi-Language Support

### Before (TypeScript-Only Harness)
- ❌ Cannot touch Java backend
- ❌ Cannot touch Go worker
- ❌ Cannot touch Rust CLI
- ❌ Cannot safely modify Python scripts
- **Result**: Harness only works on ~20% of codebase

### After (Multi-Language Harness)
- ✅ Full understanding of TypeScript frontend
- ✅ Can modify Java backend services
- ✅ Can enhance Go worker processes
- ✅ Can improve Rust CLI tools
- ✅ Can update Python data scripts
- **Result**: Harness can work on 100% of codebase

---

## Adding a New Language

### Example: Add C# (.NET) Support

**Step 1**: Implement 3 interfaces

```typescript
// src/parsers/CSharpParser.ts
export class CSharpParser implements LanguageParser {
  language = "csharp";
  
  findSourceFiles(rootPath: string): string[] { /* ... */ }
  extractSymbols(filePath: string): Symbol[] { /* ... */ }
  // ... rest of interface
}

// src/validators/CSharpValidator.ts
export class CSharpValidator implements LanguageValidator {
  language = "csharp";
  
  validateSyntax(filePath: string): ValidationResult { /* ... */ }
  // ... rest of interface
}

// src/test-runners/CSharpTestRunner.ts
export class CSharpTestRunner implements LanguageTestRunner {
  language = "csharp";
  
  runTests(rootPath: string): TestResult { /* ... */ }
  // ... rest of interface
}
```

**Step 2**: Register components

```typescript
// In src/index.ts or a bootstrap file
ParserRegistry.register(new CSharpParser());
ValidatorRegistry.register(new CSharpValidator());
TestRunnerRegistry.register(new CSharpTestRunner());
```

**Step 3**: Update config

```yaml
# config/languages.yml
  csharp:
    name: "C# (.NET)"
    fileExtensions: ['.cs']
    buildSystems: ['dotnet']
    validators:
      - type: 'syntax'
        tool: 'dotnet-build'
        command: 'dotnet build'
    testRunners:
      - type: 'unit'
        tool: 'xunit'
        command: 'dotnet test'
```

**Done!** The harness now works with C# projects.

---

## Roadmap

### Phase 1 ✅ (This Work)
- [x] Language-agnostic interfaces
- [x] TypeScript implementation
- [x] Language detection
- [x] Registries for discovery

### Phase 2 (Next)
- [ ] Java support (ANTLR parser + Maven)
- [ ] Python support (AST module)
- [ ] Go support (Tree-sitter)
- [ ] Rust support (Tree-sitter)

### Phase 3
- [ ] Real-world testing on polyglot projects
- [ ] Performance optimization (cache parsed ASTs)
- [ ] Advanced features (cross-language refactoring)

---

## See Also

- `docs/MULTI_LANGUAGE_SUPPORT.md` — Architecture details
- `config/languages.yml` — Per-language configuration
- `src/parsers/` — Parser implementations
- `src/validators/` — Validator implementations
- `src/test-runners/` — Test runner implementations
