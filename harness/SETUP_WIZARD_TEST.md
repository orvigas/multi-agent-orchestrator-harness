# Setup Wizard Test — Example Project Walkthrough

**Test Type:** Interactive Configuration Simulation  
**Example Project:** E-Commerce Platform (NestJS + TypeScript)  
**Estimated Time:** 15 minutes to review  

---

## Overview

This document demonstrates the Setup Wizard process with a **complete real-world example**: an e-commerce platform built with NestJS (TypeScript backend + PostgreSQL).

It shows:
- Every question the wizard asks
- Expected answers for this project
- What gets generated automatically
- First ticket creation
- Test run results

**Purpose:** Help AI agents understand the wizard flow, and let new users see what the experience will be.

---

## Example Project Profile

```
ProjectName: TechShop - E-commerce platform for tech gadgets
Language: TypeScript
Framework: NestJS
Team Size: 5-10 people
Database: PostgreSQL
Testing: Jest (unit + integration)
CI/CD: GitHub Actions
Deployment: Daily automated deploys
Status: Production (3 months old, 50K LOC)
```

---

## Phase 1: Project Discovery — Full Walkthrough

### Q1.1: Project Name & Description

```
Q: What is your project called, and what does it do?
   Example: "MyApp - An e-commerce platform for handmade goods"

A: TechShop - An e-commerce platform for tech gadgets
   Users browse, filter, and purchase tech products.
   Admin dashboard for inventory management.

STORED: PROJECT_NAME = "TechShop - E-commerce"
        PROJECT_DESCRIPTION = "Tech gadget marketplace"
```

**Why this matters:** Personalizes context docs and patterns.

---

### Q1.2: Primary Language

```
Q: What is the primary language of your codebase?

OPTIONS:
  1) TypeScript / JavaScript (Node.js)
  2) Python
  3) Java
  4) Go
  5) Rust
  6) C# / .NET
  7) Other

A: 1 (TypeScript/JavaScript - NestJS backend)

STORED: PRIMARY_LANG = "typescript"
        Load TypeScript-specific patterns
```

**What this unlocks:**
- TypeScript parser and validator
- Jest test structure expectations
- Node.js ecosystem assumptions

---

### Q1.3: Web Framework

```
Q: What is your primary web framework?

OPTIONS (for TypeScript):
  1) Express.js
  2) NestJS
  3) Next.js
  4) Fastify
  5) Other

A: 2 (NestJS)

STORED: FRAMEWORK = "nestjs"
        Load NestJS-specific patterns:
        - Module structure
        - Dependency injection
        - Controllers/Services/Repositories
        - DTOs for validation
        - Decorators
```

**What this unlocks:**
- NestJS code generation patterns
- Knows how to create modules, services, controllers
- Understands @Injectable(), @Controller(), @Post() decorators
- Expects .spec.ts test files
- Knows about module imports/exports

---

### Q1.4: Project Structure

```
Q: Show your current project structure (first 3 levels).

A:
techshop/
├── src/
│   ├── modules/
│   │   ├── products/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── entities/
│   │   │   ├── dtos/
│   │   │   └── products.module.ts
│   │   ├── orders/
│   │   ├── users/
│   │   ├── auth/
│   │   └── common/
│   │       ├── filters/
│   │       ├── guards/
│   │       ├── interceptors/
│   │       └── decorators/
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── main.ts
│   └── app.module.ts
├── test/
│   ├── e2e/
│   └── unit/
├── .env.example
├── .github/workflows/
│   ├── test.yml
│   └── deploy.yml
├── package.json
├── tsconfig.json
└── docker-compose.yml

STORED: PROJECT_STRUCTURE = <above>
        Analyze: Good module structure, clear separation
        Suggestion: Consider moving database migrations to forbidden zones
```

**What the harness learns:**
- Module-based organization
- Each module has controller/service/entity/dto
- Database migrations exist (will mark as forbidden)
- GitHub Actions CI/CD
- TypeScript + Node.js conventions

---

### Q1.5: Code Quality & Testing

```
Q: How do you currently handle testing and code quality?

CHECKBOXES:
  ☑ Unit tests (Jest)
  ☑ Integration tests
  ☐ E2E tests
  ☑ Linting (ESLint)
  ☑ Type checking (TypeScript)
  ☑ Code coverage tracking
  ☑ CI/CD pipeline

Current coverage: 78%

STORED: TEST_STACK = "jest,integration,eslint,typescript,coverage,ci-cd"
        COVERAGE = 78%
```

**What the harness knows:**
- Must run Jest tests and they must pass
- ESLint is enforced (linting failures = escalation)
- TypeScript strict mode is on (tsc must pass)
- Generated code must not drop coverage below 78%
- CI/CD validates everything (GitHub Actions runs tests)

---

### Q1.6: Architectural Patterns

```
Q: What architectural patterns or constraints should the harness respect?

A:
- Monolithic NestJS backend with clear module separation
- Domain-driven design: each business domain = separate module
- Service layer for business logic
- Entity/DTO separation (DTOs for API contracts)
- Repository pattern for database access
- No circular dependencies (enforced)
- Authentication via JWT tokens
- Role-based access control (RBAC)

STORED: ARCHITECTURE_NOTES = <above>
```

**Generated rule:** When creating new features:
1. Create new module if new domain
2. Include controller, service, entity, DTO
3. Add to main app.module.ts imports
4. Follow entity→service→controller flow
5. No circular dependencies allowed

---

### Q1.7: Sensitive Areas & Restrictions

```
Q: What parts of your codebase are FORBIDDEN to modify?

CHECKBOXES:
  ☑ Database migrations (database/migrations/)
  ☑ CI/CD configuration (.github/workflows/)
  ☑ Security/auth core (src/auth/)
  ☐ Billing/payment system [not yet implemented]
  ☐ Legacy code
  ☐ Third-party integrations

CUSTOM RESTRICTIONS:
  - docker/          [Infrastructure as Code]
  - docker-compose.yml
  - .github/workflows/deploy.yml  [Production deployment]

STORED: FORBIDDEN_ZONES = [
  "database/migrations/",
  ".github/workflows/",
  "src/auth/",
  "docker/",
  "docker-compose.yml",
  ".github/workflows/deploy.yml"
]
```

**What gets generated in `.harness/rules/forbidden-zones.md`:**

```markdown
# Forbidden Zones - TechShop

## Absolute Forbidden Zones

### Security & Secrets
- secrets/
- .env*
- **/*.pem
- **/*.key

### Infrastructure
- .github/workflows/ (CI/CD pipelines need approval)
- docker/ (Containerization decisions)
- docker-compose.yml

### Database
- database/migrations/ (Schema changes need DBA review)

### Authentication
- src/auth/ (Security critical - JWT, RBAC logic)

## Why This Matters

Modifications to these zones require human approval.
```

---

### Q1.8: Code Conventions

```
Q: What are your team's coding conventions?

A:
TypeScript/NestJS specific:
- Naming: Classes = PascalCase, functions = camelCase
- Files: feature.controller.ts, feature.service.ts, feature.entity.ts
- Modules: features are modules, organized by domain
- DTOs: For request validation (class-validator decorators)
- Entities: Database models with TypeORM decorators
- Error handling: Custom exception filters, HttpException subclasses
- Testing: Jest with mocking, colocate with source *.spec.ts
- Imports: Absolute paths from src/ (configured in tsconfig)

Examples:
  - File: src/modules/products/controllers/product.controller.ts
  - Service: src/modules/products/services/product.service.ts
  - DTO: src/modules/products/dtos/create-product.dto.ts
  - Entity: src/modules/products/entities/product.entity.ts
  - Test: src/modules/products/services/product.service.spec.ts

STORED: CODE_CONVENTIONS = <above>
```

**Generated patterns in `.harness/architecture/patterns.md`:**

```markdown
# Naming Conventions

## Files & Classes
- Controllers: `product.controller.ts` (exports ProductController)
- Services: `product.service.ts` (exports ProductService)
- Entities: `product.entity.ts` (exports Product @Entity)
- DTOs: `create-product.dto.ts` (exports CreateProductDto)
- Test: `*.spec.ts` (colocate with source)

## Code Organization
```
src/modules/[domain]/
├── controllers/[domain].controller.ts
├── services/[domain].service.ts
├── entities/[domain].entity.ts
├── dtos/
│   ├── create-[domain].dto.ts
│   ├── update-[domain].dto.ts
│   └── [domain].dto.ts
├── [domain].module.ts
└── [domain].repository.ts
```

## Decorators & Patterns
- Use @Controller('/path') for routes
- Use @Get(), @Post(), @Put(), @Delete()
- Use @Param(), @Query(), @Body() for parameters
- Use @UseGuards() for authentication
- Use @UseInterceptors() for logging/transformation
```

---

### Q1.9: Team & Deployment

```
Q: Team size and deployment frequency?

Team size: 5-10 people

Deployment: Multiple times per day (CI/CD)

CI/CD tool: GitHub Actions

STORED: TEAM_SIZE = "5-10"
        DEPLOYMENT_FREQ = "Multiple times per day"
        CI_CD_TOOL = "GitHub Actions"
```

**What this means for the harness:**
- Smaller PRs preferred (risk management)
- Fast iteration expected (recovery has limited time)
- Automated testing is strict (deploy.yml must pass)
- Multiple people review (coordination considerations)

---

## Phase 2: API Key & Environment

### Q2.1: LLM Provider

```
Q: Which LLM provider do you want to use?

OPTIONS:
  1) Anthropic Claude (recommended)
  2) OpenAI GPT-4
  3) OpenRouter

A: 1 (Anthropic Claude)

STORED: PRIMARY_PROVIDER = "anthropic"
        API_KEY_NAME = "ANTHROPIC_API_KEY"
        API_URL = "https://console.anthropic.com/account/keys"
```

---

### Q2.2: API Key

```
Q: Do you have API key ready?

INFO: Get key at https://console.anthropic.com/account/keys

A: [Paste key - hidden from display]

STORED: ANTHROPIC_API_KEY = sk-ant-v0-...
        Will be written to harness/.env (gitignored)
```

---

### Q2.3: Budget

```
Q: Monthly LLM budget?

Monthly budget: $300
  (Medium project: 50-100 tickets/month, ~$3-5/ticket average)

Hard limit: $400
  (Don't go over this even if enabled)

Downgrade strategy: true
  (When > 80% budget, try cheaper models: Opus → Sonnet → Haiku)

STORED: MONTHLY_BUDGET = 300
        HARD_LIMIT = 400
        DOWNGRADE_STRATEGY = true
```

**Implication:** Token budget enforcer will:
- Track spend per ticket
- Alert at 80% (try cheaper model)
- Abort at 100% (hard limit reached)

---

## Phase 3: Knowledge Engine

### Q3.1: Codebase Size

```
Q: How big is your codebase?

File count: 500-2000 files
LOC: 50K-200K

Current: ~120 TypeScript files, ~85K LOC

STORED: CODEBASE_SIZE = "500-2000"
        LOC = "50K-200K"
```

**Knowledge Engine tuning:**
- Medium codebase → moderate search depth
- TF-IDF vector index will include all files
- Search prioritizes relevance, not speed

---

### Q3.2: Key File Locations

```
Q: Key locations the harness should focus on?

A:
- src/modules/products/    (Product domain, core feature)
- src/modules/orders/      (Order processing, complex logic)
- src/modules/auth/        (Authentication - forbidden to modify)
- src/common/filters/      (Global error handling)
- src/common/guards/       (Role-based access control)
- src/config/              (App configuration)
- src/database/seeders/    (Test data)

STORED: KEY_LOCATIONS = <above>
        Create .harness/architecture/key-files.md with these
```

**Used by Knowledge Engine:**
- When searching for evidence, prioritize these locations
- When finding related code, start here
- Quick lookup map for common patterns

---

## Phase 4: Governance — Auto-Generated Files

### Generated: `.harness/rules/forbidden-zones.md`

```markdown
# Forbidden Zones - TechShop

## Absolute Forbidden Zones

### Security & Secrets
- `secrets/`
- `.env*`
- `**/*.pem`
- `**/*.key`

### Infrastructure
- `.github/workflows/` (CI/CD pipelines)
- `docker/` (Container definitions)
- `docker-compose.yml`

### Database
- `database/migrations/` (Schema changes need DBA)

### Authentication
- `src/auth/` (JWT, RBAC - security critical)

## Why This Matters

The harness respects these zones ABSOLUTELY.
If a ticket requires modifying forbidden zones → automatic escalation to human review.
```

### Generated: `.harness/architecture/patterns.md`

```markdown
# Architecture & Patterns - TechShop

## Project Overview
**Name:** TechShop - E-commerce platform for tech gadgets  
**Language:** TypeScript  
**Framework:** NestJS  
**Team:** 5-10 people  
**Deployment:** Multiple times daily (GitHub Actions)

## Architecture
- Monolithic NestJS backend
- Module-based organization (Domain-driven design)
- Service layer pattern
- Entity/DTO separation
- Repository pattern for database access
- JWT-based authentication
- Role-based access control (RBAC)

## Module Structure

All business features are modules in `src/modules/`:

```
src/modules/[domain]/
├── controllers/[domain].controller.ts     # HTTP endpoints
├── services/[domain].service.ts           # Business logic
├── entities/[domain].entity.ts            # Database model (TypeORM)
├── dtos/                                  # API contracts
│   ├── create-[domain].dto.ts
│   ├── update-[domain].dto.ts
│   └── [domain].dto.ts
├── [domain].repository.ts                 # Database queries
├── [domain].module.ts                     # Module definition
└── [domain].service.spec.ts               # Tests
```

## Code Patterns

### Creating a New Feature
1. Create new module in `src/modules/feature/`
2. Add controller with @Controller('/feature')
3. Add service with business logic
4. Create entity for database model
5. Create DTOs for request/response
6. Add repository for queries
7. Register module in app.module.ts
8. Write tests alongside source

### Error Handling
- Use custom exception filters
- Extend HttpException
- Always return meaningful error messages
- Log errors with context

### Testing
- Jest framework
- Colocate tests (*.spec.ts)
- Mock dependencies with jest.mock()
- Test controller endpoints
- Test service logic separately
- Integration tests for full flow

## Key Locations
- **Products domain:** `src/modules/products/`
- **Orders domain:** `src/modules/orders/`
- **Global filters:** `src/common/filters/`
- **Guards (auth):** `src/common/guards/`
- **Config:** `src/config/`

## Important Constraints
- No circular dependencies
- Services must be testable (inject dependencies)
- DTOs validate input (class-validator)
- Entities map to database (TypeORM)
- All public endpoints require authentication
- RBAC: Check roles in guards
```

### Generated: `.harness/governance/policy.md`

```markdown
# Governance & Recovery Policy - TechShop

## Hard Rules (Never Violated)

1. **Forbidden Zones:** Never modify database/migrations/, .github/workflows/, src/auth/
2. **Security:** If npm audit finds HIGH severity → Always escalate
3. **Build:** TypeScript compiler (tsc) must pass
4. **Tests:** Jest tests must pass, coverage must not drop below 78%
5. **Budget:** Never exceed $400/month

## Escalation Triggers

Manual human review required for:
- Forbidden zone violation (database/migrations/, .github/, src/auth/)
- Security issue found (npm audit HIGH/CRITICAL)
- Merge conflict
- Build failure (tsc error)
- Test failure (jest failure)
- Coverage drop > 5%
- TypeScript strict mode violation

## Recovery Strategy

- Max iterations per ticket: 3
- Max retries per strategy: 2
- If repeated failure → Force strategy change

## When to Abort

- Security risk confirmed
- Merge conflict unresolvable
- Architecture violation
- Budget exceeded ($400)
- Max iterations exceeded

## Cost Controls

- Monthly budget: $300
- Hard limit: $400
- Downgrade: When > 80% budget, try cheaper model (Opus→Sonnet→Haiku)
- Alert: When > 95% budget
```

---

## Phase 5: First Ticket

### Ticket Type Selection

```
Q: What kind of task do you want to handle first?

OPTIONS:
  1) Bug Fix
  2) Feature Addition
  3) Refactoring
  4) Documentation

A: 2 (Feature Addition - most common for TechShop)
```

---

### Create First Example Ticket

```
Q: Let's create your first ticket

Ticket ID: FEAT-1001
Title: Add product search filters (price, category, rating)
Description:
  Currently users can only browse all products.
  Need ability to filter by price range, category, and minimum rating.

Target Repo Path: /Users/team/TechShop

Requirements:
  1. Update ProductController to accept query params:
     - minPrice, maxPrice (number)
     - category (string)
     - minRating (0-5)
  
  2. Update ProductService.findAll() to filter:
     - Use TypeORM QueryBuilder for efficient filtering
     - Validate input ranges
  
  3. Update ProductDto to reflect filters:
     - Add validation decorators (class-validator)
  
  4. Tests:
     - Test each filter independently
     - Test combined filters
     - Test invalid inputs (negative prices, etc.)
  
  Constraints:
  - Do NOT modify database schema
  - MUST maintain 78%+ coverage
  - Performance: query must complete in < 200ms

STORED: TICKET_ID = FEAT-1001
        TICKET_TITLE = "Add product search filters..."
        TICKET_DESC = "..."
        TARGET_REPO_PATH = "/Users/team/TechShop"
        REQUIREMENTS = "..."
```

---

## Phase 6 & 7: Generated Files & First Run

### Generated: `harness/.env`

```bash
# Multi-Agent Harness Configuration
# Generated: 2026-07-30T10:00:00Z

# ============================================
# LLM Configuration
# ============================================
PRIMARY_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-v0-...

# Mode: deterministic (no LLM) or llm (real Claude)
HARNESS_MODE=deterministic

# ============================================
# Database
# ============================================
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db

# ============================================
# Budget & Cost Control
# ============================================
MONTHLY_BUDGET=300
HARD_LIMIT=400
DOWNGRADE_STRATEGY=true
```

### Generated: `harness/backlog.json`

```json
{
  "tickets": [
    {
      "ticketId": "FEAT-1001",
      "title": "Add product search filters (price, category, rating)",
      "description": "Currently users can only browse all products. Need ability to filter by price range, category, and minimum rating.",
      "targetRepoPath": "/Users/team/TechShop",
      "priority": "normal",
      "requirements": "1. Update ProductController to accept query params...\n2. Update ProductService.findAll() to filter...\n3. Update ProductDto...\n4. Tests...\n\nConstraints:\n- Do NOT modify database schema\n- MUST maintain 78%+ coverage\n- Performance: < 200ms"
    }
  ],
  "metadata": {
    "createdAt": "2026-07-30T10:00:00Z",
    "projectName": "TechShop - E-commerce",
    "language": "typescript",
    "framework": "nestjs"
  }
}
```

---

## First Test Run (Deterministic Mode)

### Expected Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                  Multi-Agent Orchestrator - Deterministic Mode               ║
╚══════════════════════════════════════════════════════════════════════════════╝

Loading configuration...
✓ Config loaded (deterministic mode - no LLM calls)
✓ Forbidden zones verified
✓ Knowledge Engine initialized
✓ Patterns loaded from .harness/architecture/

Processing ticket: FEAT-1001
═════════════════════════════════════════════════════════════════════════════════

[Layer 1: Knowledge Engine] - Searching for evidence
───────────────────────────────────────────────────────────────────────────────
  Q: Need to add search filters to products
  
  Evidence collection:
  ✓ Found ProductController at src/modules/products/controllers/product.controller.ts
  ✓ Found ProductService at src/modules/products/services/product.service.ts
  ✓ Found ProductEntity at src/modules/products/entities/product.entity.ts
  ✓ Found ProductDto at src/modules/products/dtos/product.dto.ts
  ✓ Found existing @Query() decorators in controller
  ✓ Found TypeORM repository pattern in use
  ✓ Test structure: product.service.spec.ts (existing)
  
  Confidence: 95% (strong evidence base)

[Layer 2: Planner] - Creating execution plan
───────────────────────────────────────────────────────────────────────────────
  Discovery:
    ✓ Feature type: Add filters to existing endpoint
    ✓ Complexity: Medium (new query params + logic)
    ✓ Risk: Low (isolated change, no schema modification)
    ✓ Dependencies: None external
    ✓ Test coverage needed: 4 new tests minimum
  
  Plan (3 tasks):
    1. UPDATE ProductController
       → Add @Query('minPrice'), @Query('maxPrice'), etc.
       → Pass to service
       
    2. UPDATE ProductService.findAll()
       → Add filtering logic with QueryBuilder
       → Validate price ranges
       
    3. UPDATE ProductDto & ADD tests
       → Add filter validation
       → Write 4 test cases

  Risk assessment: LOW
  Plan confidence: 92%

[Layer 3: Implementation] - Generating patches
───────────────────────────────────────────────────────────────────────────────
  Task 1: ProductController update
    Generating patch...
    ✓ Identified insertion point (after existing @Query decorators)
    ✓ Generated 12 lines of code
    
  Task 2: ProductService.findall() update
    Generating patch...
    ✓ Identified insertion point (filtering logic section)
    ✓ Generated 18 lines with QueryBuilder filter logic
    
  Task 3: Tests & validation
    Generating patch...
    ✓ Generated 4 test cases (each filter + combined)
    ✓ ~40 lines total

  Total changes: 70 lines across 3 files
  Sandbox: Created /tmp/techshop-sandbox-XXXXX/

[Layer 4: Validation Pipeline] - Running tools
───────────────────────────────────────────────────────────────────────────────
  ✓ [Compile] tsc --noEmit
    Result: SUCCESS (0 errors, 0 warnings)
    
  ✓ [Tests] npm test -- --testPathPattern=product
    Result: SUCCESS (8 tests pass, 4 new pass)
    Coverage: 79.2% (was 78%, +1.2% ✓)
    
  ✓ [Lint] eslint src/modules/products/
    Result: SUCCESS (no violations)
    
  ✓ [Security] npm audit
    Result: SUCCESS (no vulnerabilities)

  All validations PASSED ✓

[Layer 5: Recovery] - Not needed
───────────────────────────────────────────────────────────────────────────────
  No failures detected, skipping recovery

[Layer 6: Quality Gate] - Checking metrics
───────────────────────────────────────────────────────────────────────────────
  ✓ Code coverage: 79.2% (target: 78%) ✓
  ✓ Architecture: No violations
  ✓ Performance: Expected query time < 200ms ✓
  ✓ Breaking changes: None
  
  Quality verdict: PASS ✓

[Layer 7: Merge Manager] - Preparing merge
───────────────────────────────────────────────────────────────────────────────
  ✓ Conflict check: None
  ✓ Patch validation: 100%
  ✓ Ready to merge: YES
  
  Summary:
    Files modified: 3
    Lines added: 70
    Tests added: 4
    Coverage change: +1.2%

═════════════════════════════════════════════════════════════════════════════════

✅ TICKET PROCESSED SUCCESSFULLY

Summary:
  Ticket: FEAT-1001
  Status: READY TO MERGE
  Time taken: 2.3 seconds (deterministic heuristics)
  Result: 3 files modified, 4 tests added, coverage improved
  
  Changes are in:
    /tmp/techshop-sandbox-XXXXX/
  
  Review patches:
    npm run logs

Decision trail saved to:
  data/harness-checkpoints.db
```

---

## What You'd Do Next

### 1. Review the Generated Code

```bash
cd harness
npm run logs  # See detailed decision trail
```

Output:
```
FEAT-1001 Decision Trail:
  - Knowledge Engine found 6 evidence files (95% confidence)
  - Planner created 3-task plan (92% confidence)
  - Implementation generated 70 lines of code
  - Validation: All checks passed
  - Coverage improved from 78% to 79.2%
  - Ready for merge
```

### 2. Switch to LLM Mode (Optional)

```bash
# Edit .env
HARNESS_MODE=llm

# Next ticket will use real Claude
npm run dev
```

### 3. Monitor Costs

```bash
npm run costs

# Output:
# FEAT-1001:
#   Discovery: $0.08
#   Planning: $0.15
#   Implementation: $0.25
#   Total: $0.48
```

---

## Key Insights from This Test

### What the Wizard Achieved

1. ✅ **Project Understanding**
   - Recognized NestJS patterns
   - Understood module structure
   - Knew about DTOs and entities
   - Learned about testing conventions

2. ✅ **Safety Configuration**
   - Marked database migrations as forbidden
   - Marked .github/workflows/ as off-limits
   - Protected src/auth/ (security critical)
   - Set coverage thresholds

3. ✅ **Knowledge Encoding**
   - `.harness/rules/` prevents dangerous changes
   - `.harness/architecture/` guides code generation
   - `.harness/governance/` sets escalation rules

4. ✅ **First Ticket Success**
   - Successfully planned 3-task feature
   - Generated correct NestJS patterns
   - Passed all validations
   - Improved code coverage

### Why This Matters

The Setup Wizard doesn't just configure files. It **encodes project knowledge** that makes the harness smarter:

- Knows NestJS patterns
- Respects team's conventions
- Avoids dangerous zones
- Generates code in correct style
- Understands success criteria (78% coverage)

---

## For AI Agents

### How to Run This Test

1. **Read this document completely**
2. **Execute wizard in deterministic mode:**
   ```bash
   cd harness
   bash setup-wizard.sh
   # At prompts, answer with TechShop example values
   npm run dev  # Test run
   ```
3. **Verify all files generated correctly:**
   ```bash
   ls -la .env backlog.json ../.harness/
   ```
4. **Check output matches expected format**

### How to Adapt for Other Projects

Same flow, different answers:
- **Django project?** Answer "Python" + "Django" → different patterns
- **Spring Boot?** Answer "Java" + "Spring Boot" → different patterns
- **Go microservice?** Answer "Go" + "Gin" → different patterns

The wizard adapts to any tech stack.

---

**Status:** ✅ Complete Example Provided  
**Next Step:** Try wizard with real project  
**Time to first ticket:** 45-60 minutes  

