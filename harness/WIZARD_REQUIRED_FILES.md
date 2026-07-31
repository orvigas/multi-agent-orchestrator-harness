# 🗂️ Required Files & Configuration Guide

**Complete reference for every file the harness needs, what it does, and how to fill it**

After the wizard completes, your project must have these files configured correctly. This guide explains each one.

---

## Required Files Checklist

```
✅ MANDATORY (Must have to function)
├── harness/.env
├── harness/backlog.json
├── .harness/rules/forbidden-zones.md
├── .harness/architecture/patterns.md
└── .harness/governance/policy.md

⭐ OPTIONAL (Nice to have, enabled later)
├── harness/config/providers.yml (auto-generated)
├── .harness/architecture/key-files.md
└── .harness/architecture/performance-guidelines.md
```

---

## 1️⃣ `harness/.env` — Configuration & Secrets

### Purpose
Controls how the harness runs: which LLM, what mode, database location, budget limits.

### What It Controls
- **LLM Provider**: Which AI (Anthropic, OpenAI, OpenRouter)
- **API Keys**: Authentication for LLM calls
- **Budget**: Monthly limit and hard cap
- **Mode**: Deterministic (testing) vs LLM (production)
- **Database**: Where to store checkpoints

### Structure

```bash
# ============================================
# LLM Configuration
# ============================================
PRIMARY_PROVIDER=anthropic          # or openai, openrouter
ANTHROPIC_API_KEY=sk-ant-v0-...    # or OPENAI_API_KEY, OPENROUTER_API_KEY
HARNESS_MODE=deterministic         # or llm

# ============================================
# Database
# ============================================
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db

# ============================================
# Budget & Cost Control
# ============================================
MONTHLY_BUDGET=300                  # USD
HARD_LIMIT=400                      # USD (absolute max)
DOWNGRADE_STRATEGY=true             # When budget high, try cheaper model

# ============================================
# Observability (optional)
# ============================================
LANGCHAIN_TRACING_V2=false
# LANGCHAIN_API_KEY=ls-...

# ============================================
# Environment
# ============================================
NODE_ENV=development                # or production
```

### How to Fill It

#### Q: What LLM provider should I use?

**Option 1: Anthropic Claude (Recommended)**
```bash
PRIMARY_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-v0-{your-key}
```
Get key: https://console.anthropic.com/account/keys

**Option 2: OpenAI GPT-4**
```bash
PRIMARY_PROVIDER=openai
OPENAI_API_KEY=sk-{your-key}
```
Get key: https://platform.openai.com/account/api-keys

**Option 3: OpenRouter (Any model, proxy)**
```bash
PRIMARY_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-{your-key}
```
Get key: https://openrouter.ai/keys

#### Q: What's the difference between HARNESS_MODE?

**Deterministic Mode** (for testing)
```bash
HARNESS_MODE=deterministic
```
- ❌ No LLM calls (no Claude)
- ✅ Fast (uses heuristics)
- ✅ No costs
- ✅ Reproducible (same result every run)
- Use for: Testing, CI/CD validation, first setup

**LLM Mode** (for production)
```bash
HARNESS_MODE=llm
```
- ✅ Uses Claude (intelligent decisions)
- ✅ Better code generation
- ✅ Flexible (handles complexity)
- ❌ Costs money ($0.50-$5 per ticket)
- ❌ May be slower
- Use for: Real feature development, after you validate setup

#### Q: What budget should I set?

**Small teams / testing:**
```bash
MONTHLY_BUDGET=100
HARD_LIMIT=150
```
Suitable for: Solo developers, testing, learning

**Medium team / regular use:**
```bash
MONTHLY_BUDGET=300
HARD_LIMIT=400
```
Suitable for: 5-15 person teams, 50-100 tickets/month

**Large team / heavy use:**
```bash
MONTHLY_BUDGET=1000
HARD_LIMIT=1500
```
Suitable for: 15+ person teams, 100+ tickets/month

**Calculation:**
- Average cost per ticket: $0.50 - $5 (depends on complexity)
- Tickets per month: 50 average = $25-250/month
- Add 20% buffer for failed attempts

#### Q: Should I use downgrade strategy?

**If yes (recommended):**
```bash
DOWNGRADE_STRATEGY=true
```
When budget gets high (>80%), automatically try cheaper models:
- Opus → Sonnet → Haiku (within Anthropic)
- gpt-4 → gpt-3.5-turbo (within OpenAI)

**If no:**
```bash
DOWNGRADE_STRATEGY=false
```
Keep using expensive model, even if budget high. Or abort when budget reached.

### Example Configurations

**Startup (learning phase):**
```bash
PRIMARY_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-v0-abc123...
HARNESS_MODE=deterministic    # Start here!
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db
MONTHLY_BUDGET=100
HARD_LIMIT=150
DOWNGRADE_STRATEGY=true
NODE_ENV=development
```

**Production (real work):**
```bash
PRIMARY_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-v0-abc123...
HARNESS_MODE=llm              # Switch after testing
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db
MONTHLY_BUDGET=500
HARD_LIMIT=700
DOWNGRADE_STRATEGY=true
NODE_ENV=production
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
```

### Validation

Check your .env is valid:
```bash
cd harness
npm run typecheck
# Should pass with no errors
```

---

## 2️⃣ `harness/backlog.json` — Tickets to Process

### Purpose
List of tickets (bugs, features, refactorings) for the harness to work on.

### Structure

```json
{
  "tickets": [
    {
      "ticketId": "TASK-1",
      "title": "Short description (max 70 chars)",
      "description": "2-3 line context",
      "targetRepoPath": "/absolute/path/to/repo",
      "priority": "normal",
      "requirements": "Detailed specification",
      "context": "Optional: related issues"
    }
  ],
  "metadata": {
    "createdAt": "2026-07-30T10:00:00Z",
    "projectName": "Your Project Name",
    "targetRepoPath": "/absolute/path/to/repo"
  }
}
```

### How to Fill It

#### Example 1: Bug Fix

```json
{
  "ticketId": "BUG-1",
  "title": "Fix null pointer in email validation",
  "description": "Email validation crashes when input is null",
  "targetRepoPath": "/Users/team/myapp",
  "priority": "high",
  "requirements": "In src/validators/email.ts:\n\n1. Find where null is not checked\n2. Add null guard:\n   if (!email) throw new Error('Email required')\n3. Update error message\n4. Add test for null input\n5. Ensure all tests pass\n\nConstraints:\n- Do NOT change function signature\n- MUST keep same error handling pattern",
  "context": "Issue #2047 - users report login failures"
}
```

#### Example 2: Feature Addition

```json
{
  "ticketId": "FEAT-1",
  "title": "Add password strength validation",
  "description": "Enforce stronger passwords (min 12 chars, special chars)",
  "targetRepoPath": "/Users/team/myapp",
  "priority": "normal",
  "requirements": "Implement password strength validator:\n\n1. Update PasswordValidator.validate():\n   - Minimum 12 characters\n   - At least 1 uppercase letter\n   - At least 1 digit\n   - At least 1 special character (!@#$%^&*)\n\n2. Return detailed feedback:\n   - Which requirements failed\n   - Which ones passed\n\n3. Add tests for:\n   - Strong password (passes)\n   - Too short\n   - Missing uppercase\n   - Missing digits\n   - Missing special chars\n\n4. Update error messages in UI\n\nConstraints:\n- Do NOT change existing weaker validations yet\n- Must be backward compatible\n- Error messages should be user-friendly",
  "context": "Security audit recommends stronger passwords"
}
```

#### Example 3: Refactoring

```json
{
  "ticketId": "REFACTOR-1",
  "title": "Extract common validation logic to shared utils",
  "description": "Email and username validation have duplicate regex logic",
  "targetRepoPath": "/Users/team/myapp",
  "priority": "normal",
  "requirements": "Reduce code duplication in validators:\n\n1. Create src/validators/common/pattern-validators.ts:\n   - isValidEmail(pattern)\n   - isValidUsername(pattern)\n   - isValidPhoneNumber(pattern)\n\n2. Refactor existing validators:\n   - src/validators/email.ts → use common\n   - src/validators/username.ts → use common\n   - src/validators/phone.ts → use common\n\n3. Keep public API identical (no breaking changes)\n\n4. Run existing tests (must all pass)\n\n5. No coverage reduction\n\nConstraints:\n- ZERO breaking changes\n- All tests must pass without modification",
  "context": "Code quality - reducing maintenance burden"
}
```

### How to Create Multiple Tickets

```json
{
  "tickets": [
    {
      "ticketId": "TASK-1",
      "title": "First task",
      ...
    },
    {
      "ticketId": "TASK-2",
      "title": "Second task",
      ...
    },
    {
      "ticketId": "TASK-3",
      "title": "Third task",
      ...
    }
  ],
  "metadata": { ... }
}
```

The harness processes them **in order**, one at a time.

### Metadata Section

```json
{
  "metadata": {
    "createdAt": "2026-07-30T10:00:00Z",  // When created
    "projectName": "MyApp",               // Your project name
    "targetRepoPath": "/path/to/repo",    // Default target (can override per ticket)
    "language": "typescript",             // Primary language
    "framework": "nestjs"                 // Framework
  }
}
```

### Validation

Check JSON syntax:
```bash
cat harness/backlog.json | jq .
# Should show formatted JSON with no errors
```

---

## 3️⃣ `.harness/rules/forbidden-zones.md` — Safety Boundaries

### Purpose
Defines what code the harness can NEVER modify. Hard safety boundaries.

### Structure

```markdown
# Forbidden Zones - [Your Project Name]

## Absolute Forbidden Zones

### Category 1: Security & Secrets
- List of paths that contain secrets

### Category 2: Infrastructure
- List of paths that control deployment

### Category 3: Database
- List of database-related paths

### Category 4: Custom (Your Project)
- Project-specific sensitive areas

## Why This Matters

Explanation of why each zone matters.
```

### How to Fill It

#### Step 1: Identify Forbidden Categories

**Universal Forbidden** (same for all projects):
```markdown
- secrets/
- .env*
- **/*.pem
- **/*.key
- **/*.p12
- password files
- credential files
```

**Project-Specific** (different per project):

**TypeScript/Node.js:**
```markdown
- .github/workflows/       (CI/CD pipeline)
- docker/                  (Containerization)
- docker-compose.yml
- Dockerfile
- src/auth/                (If authentication critical)
- database/migrations/     (If using migrations)
- terraform/               (If infrastructure-as-code)
```

**Python/Django:**
```markdown
- manage.py                (Could be modified incorrectly)
- settings.py              (Configuration)
- requirements.txt         (Only if can't pin versions)
- migrations/              (Database schema changes)
- .github/workflows/
```

**Java/Spring Boot:**
```markdown
- src/main/resources/application.yml  (Configuration)
- pom.xml                  (Maven - dependencies)
- build.gradle             (Gradle - dependencies)
- src/main/java/config/    (Configuration beans)
- database/migrations/     (Flyway/Liquibase)
```

#### Step 2: Generate Your File

**Minimal Setup** (basic safety):
```markdown
# Forbidden Zones - MyProject

## Absolute Forbidden

### Security & Secrets
- `.env*` (environment variables with secrets)
- `secrets/` (secret management)
- `**/*.pem`, `**/*.key` (certificates/keys)
- `**/*.p12` (keystores)

### Infrastructure & DevOps
- `.github/workflows/` (CI/CD pipelines)
- `docker/` (Containerization)
- `Dockerfile`, `docker-compose.yml`
- `terraform/` (if exists)

### Database
- `database/migrations/` (schema changes)
- `migrations/` (if exists)

## Why This Matters

These zones are protected by hard rules.
If a ticket requires modification → automatic escalation to human.
```

**Comprehensive Setup** (strict safety):
```markdown
# Forbidden Zones - MyProject

## Absolute Forbidden (NEVER Modify)

### Security & Secrets
- `.env*` (all environment files)
- `secrets/` (secret management)
- `config/secrets.json`
- `**/*.pem` (certificates)
- `**/*.key` (private keys)
- `**/*.p12` (keystores)
- `vault/` (if using vault)
- Any file with password/token/credential

### Infrastructure & DevOps
- `.github/workflows/` (GitHub Actions - CI/CD)
- `docker/` (Dockerfile templates)
- `docker-compose.yml`
- `kubernetes/`, `k8s/` (Kubernetes manifests)
- `terraform/` (Infrastructure as Code)
- `.gitlab-ci.yml` (GitLab CI)
- `Jenkinsfile` (Jenkins)
- `cloudfoundry/` (Cloud Foundry)

### Database & Persistence
- `database/migrations/` (SQL schema changes)
- `migrations/` (ORM migrations)
- `db/schema.sql`
- `sql/` (raw SQL files)
- `alembic/` (SQLAlchemy migrations)

### Authentication & Security
- `src/auth/` (authentication core)
- `src/security/` (security logic)
- `src/jwt/` (JWT handling)
- `src/oauth/` (OAuth implementation)
- `src/permission/` (permission rules)

### Build & Package Management
- `package-lock.json` (npm lock - READ ONLY)
- `pom.xml` (Maven - only existing deps)
- `build.gradle` (Gradle - only existing deps)
- `Cargo.lock` (Rust - READ ONLY)
- `.cargo/` (Rust config)

### Legacy & Special
- `legacy/` (Old code - risky to modify)
- `vendor/` (Third-party code)
- `node_modules/` (Dependencies)
- `/lib/` or `/libs/` (Library code)

## Conditional (Requires Review)

### Configuration Files
- `src/config/` (Can modify values, not structure)
- `settings.json` (Can modify, with care)
- `.env.example` (Template only)

### Third-Party Integration
- `src/integrations/` (Can modify, but test carefully)

### Documentation
- `README.md` (Can update)
- `docs/` (Can update)

## Why This Matters

Violations of these zones get escalated to humans.
The harness NEVER bypasses these rules.
If a ticket requires modification → manual review required.

Forbidden zones protect:
- **Security**: No access to secrets/keys
- **Stability**: No touching CI/CD, deployments
- **Data**: No direct schema changes (migrations needed)
- **Infrastructure**: No cloud/k8s changes
- **Licenses**: No third-party code modification
```

### Validation

No syntax needed, just plain markdown. Check content:
```bash
# Make sure file exists
ls -la .harness/rules/forbidden-zones.md

# Check it's readable
cat .harness/rules/forbidden-zones.md
```

---

## 4️⃣ `.harness/architecture/patterns.md` — Code Generation Guide

### Purpose
Teaches the harness YOUR project's patterns, conventions, and architectural style.

### Structure

```markdown
# Architecture & Patterns - [Your Project Name]

## Project Overview
Brief description of project

## Technology Stack
- Language, Framework, Database, etc.

## Architecture
How components fit together

## Coding Patterns
Naming, file organization, testing approach

## Framework-Specific Patterns
How to use the framework correctly

## Design Decisions
Important architectural choices

## Key Locations
Where important code lives
```

### How to Fill It — By Technology

#### TypeScript + NestJS

```markdown
# Architecture & Patterns - MyBackend

## Project Overview
NestJS REST API for user management and order processing

## Technology Stack
- Language: TypeScript
- Framework: NestJS (Express backend)
- Database: PostgreSQL + TypeORM
- Testing: Jest
- CI/CD: GitHub Actions

## Architecture
- Monolithic backend with modular structure
- Domain-driven design: each business domain = module
- Service layer for business logic
- Repository pattern for data access
- No circular dependencies

## Coding Patterns

### Naming Conventions
- **Classes**: PascalCase (ProductService, OrderController)
- **Functions**: camelCase (getUserById, calculateTotal)
- **Constants**: UPPER_SNAKE_CASE (MAX_RETRIES, API_KEY)
- **Files**: kebab-case (product.service.ts, order.controller.ts)

### File Organization
```
src/modules/[domain]/
├── controllers/
│   └── [domain].controller.ts           # HTTP endpoints
├── services/
│   └── [domain].service.ts              # Business logic
├── entities/
│   └── [domain].entity.ts               # Database model
├── dtos/
│   ├── create-[domain].dto.ts
│   ├── update-[domain].dto.ts
│   └── [domain].dto.ts
├── repositories/
│   └── [domain].repository.ts           # Data access
├── [domain].module.ts                   # Module definition
└── __tests__/
    └── [domain].service.spec.ts         # Tests
```

### NestJS Patterns

**Module Structure:**
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  controllers: [ProductController],
  providers: [ProductService, ProductRepository],
  exports: [ProductService],
})
export class ProductModule {}
```

**Controller:**
```typescript
@Controller('products')
@UseGuards(AuthGuard)
export class ProductController {
  @Get(':id')
  getProduct(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
```

**Service:**
```typescript
@Injectable()
export class ProductService {
  constructor(private repo: ProductRepository) {}
  
  async findById(id: string) {
    return this.repo.findOne(id);
  }
}
```

**Entity (Database Model):**
```typescript
@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  name: string;
  
  @CreateDateColumn()
  createdAt: Date;
}
```

**DTO (Request/Response Validation):**
```typescript
export class CreateProductDto {
  @IsString()
  @MinLength(3)
  name: string;
  
  @IsNumber()
  @Min(0)
  price: number;
}
```

### Error Handling
- Use NestJS HttpException
- Custom exception filters
- Return meaningful messages
- Log errors with context

### Testing
- Framework: Jest
- Location: `*.spec.ts` colocated with source
- Test services with mocks
- Test controllers with request/response
- Minimum coverage: 80%

## Key Locations
- **Business logic**: `src/modules/*/services/`
- **HTTP endpoints**: `src/modules/*/controllers/`
- **Database models**: `src/modules/*/entities/`
- **Global guards/filters**: `src/common/`
- **Configuration**: `src/config/`

## Important Constraints
- Modules must export services
- Services must be injectable
- No circular dependencies
- All public endpoints require auth
- RBAC checked in guards
```

#### Python + Django

```markdown
# Architecture & Patterns - MyBackend

## Technology Stack
- Language: Python 3.9+
- Framework: Django 4.2
- Database: PostgreSQL + Django ORM
- Testing: pytest + pytest-django
- API: Django REST Framework (DRF)

## Coding Patterns

### Naming
- **Classes**: PascalCase (UserSerializer, ProductViewSet)
- **Functions**: snake_case (get_user_by_id, calculate_total)
- **Constants**: UPPER_SNAKE_CASE (MAX_RETRIES, API_KEY)
- **Files**: snake_case (user_views.py, product_models.py)

### File Organization
```
myapp/
├── models.py               # Database models
├── views.py                # View logic (or viewsets for DRF)
├── serializers.py          # DRF serializers (validation)
├── urls.py                 # URL routing
├── permissions.py          # Custom permissions
├── tests/
│   ├── test_models.py
│   ├── test_views.py
│   └── test_serializers.py
└── migrations/
    ├── 0001_initial.py
    └── ... (DO NOT MODIFY)
```

### Models (Database)
```python
class Product(models.Model):
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
```

### Serializers (Validation & Response)
```python
class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'created_at']
        read_only_fields = ['id', 'created_at']
```

### ViewSets (API Endpoints)
```python
class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
```

### Testing
- Framework: pytest
- Convention: `test_*.py` files
- Use fixtures for test data
- Mock external services
- Minimum coverage: 80%

## Key Locations
- **Business logic**: `views.py`, `serializers.py`
- **Database models**: `models.py`
- **Routing**: `urls.py`
- **Migrations**: `migrations/` (DO NOT TOUCH)
- **Settings**: `settings.py` (careful edits only)

## Constraints
- Migrations are FROZEN (schema ops only)
- models.py changes must create migrations (auto)
- serializers validate input
- permissions checked in views
```

#### Java + Spring Boot

```markdown
# Architecture & Patterns - MyBackend

## Technology Stack
- Language: Java 17+
- Framework: Spring Boot 3.x
- Database: PostgreSQL + JPA
- Testing: JUnit 5 + Mockito
- Build: Maven

## Coding Patterns

### Naming
- **Classes**: PascalCase (UserService, ProductController)
- **Methods**: camelCase (getUserById, createProduct)
- **Constants**: UPPER_SNAKE_CASE (MAX_RETRIES)
- **Package structure**: com.company.module.layer

### File Organization
```
src/main/java/com/company/product/
├── controller/
│   └── ProductController.java
├── service/
│   └── ProductService.java
├── entity/
│   └── Product.java
├── repository/
│   └── ProductRepository.java
├── dto/
│   ├── CreateProductDto.java
│   └── ProductDto.java
└── config/
    └── ProductConfiguration.java

src/test/java/com/company/product/
├── ProductControllerTest.java
└── ProductServiceTest.java
```

### Entities (JPA Models)
```java
@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @Column(nullable = false)
    private String name;
    
    @CreationTimestamp
    private LocalDateTime createdAt;
}
```

### Controllers (REST Endpoints)
```java
@RestController
@RequestMapping("/api/products")
public class ProductController {
    @GetMapping("/{id}")
    public ProductDto getProduct(@PathVariable String id) {
        return service.findById(id);
    }
}
```

### Services (Business Logic)
```java
@Service
public class ProductService {
    @Autowired
    private ProductRepository repo;
    
    public ProductDto findById(String id) {
        return repo.findById(id)
            .map(this::toDto)
            .orElseThrow();
    }
}
```

### DTOs (Request/Response)
```java
public record CreateProductDto(
    @NotBlank String name,
    @Positive BigDecimal price
) {}
```

### Testing
- Framework: JUnit 5
- Mocking: Mockito
- Location: `src/test/java/`
- Test controllers with MockMvc
- Test services with mocks
- Minimum coverage: 80%

## Key Locations
- **Services**: `com.company.*.service`
- **Controllers**: `com.company.*.controller`
- **Entities**: `com.company.*.entity`
- **Repositories**: `com.company.*.repository`
- **DTOs**: `com.company.*.dto`

## Constraints
- All @Service, @Controller beans autowired
- No circular dependencies
- Repositories must extend JpaRepository
- DTOs for all public APIs
- All endpoints protected with Spring Security
```

---

## 5️⃣ `.harness/governance/policy.md` — Safety & Recovery Rules

### Purpose
Defines when the harness escalates to humans, how many retries are allowed, what triggers safety rules.

### Structure

```markdown
# Governance & Recovery Policy - [Your Project]

## Hard Rules (Never Broken)

## Escalation Triggers

## Recovery Strategy

## When to Abort
```

### How to Fill It

#### Step 1: Define Hard Rules

```markdown
## Hard Rules (Never Violated)

1. **Forbidden Zones**: Never modify [list from forbidden-zones.md]
2. **Security**: If security audit finds HIGH/CRITICAL → Always escalate
3. **Build**: [Language compiler] must pass (tsc, javac, go build, etc.)
4. **Tests**: Existing tests must pass, coverage must not drop
5. **Budget**: Never exceed $[HARD_LIMIT]/month
6. **Performance**: No degradation > [X]% on key operations
```

#### Step 2: Define Escalation Triggers

```markdown
## Escalation Triggers

Manual human review required for:

- ✓ Forbidden zone violation (automatic escalation)
- ✓ Security issue found (npm audit HIGH+, cargo audit, etc.)
- ✓ Merge conflict detected
- ✓ Build failure after 2 retry attempts
- ✓ Test failure (must diagnose root cause)
- ✓ Architecture violation
- ✓ Coverage drop > 5%
- ✓ API contract change (breaking change)
- ✓ Database schema change
- ✓ Third-party integration modification
```

#### Step 3: Recovery Strategy

```markdown
## Recovery Strategy

- **Max iterations**: 3 attempts per ticket
- **Max retries per strategy**: 2
- **Anti-fixation**: If repeated failure → Force strategy change

### Retry Strategies (in order)
1. **Retry**: Same approach, clearer error context
2. **Change Planning**: Re-plan, different approach
3. **Simplify**: Reduce scope, simpler requirements
4. **Escalate**: Manual human decision

If strategy 3 fails → Must escalate (never retry same failed strategy)
```

#### Step 4: Abort Conditions

```markdown
## When to Abort (Never Auto-Retry)

- ✓ Security risk confirmed
- ✓ Merge conflict unresolvable
- ✓ Forbidden zone violated
- ✓ Architecture violation (that's intentional)
- ✓ Budget exceeded ($[HARD_LIMIT])
- ✓ Max iterations exceeded (3x)
- ✓ User explicitly requested abort
```

### Example Files by Tech Stack

#### NestJS/TypeScript
```markdown
# Governance & Recovery Policy - MyApp

## Hard Rules (Never Violated)

1. **Forbidden Zones**: .github/workflows/, database/migrations/, src/auth/
2. **Security**: npm audit finds HIGH+ → Always escalate
3. **Build**: tsc --noEmit must pass
4. **Tests**: Jest tests must pass, coverage ≥ 78%
5. **Budget**: Never exceed $400/month
6. **Types**: No TypeScript errors (strict mode)

## Escalation Triggers

- Forbidden zone modification
- Security audit failure
- TypeScript compilation error
- Jest test failure (any)
- Coverage drop > 5%
- Merge conflict
- API contract breaking change

## Recovery Strategy

- Max 3 iterations per ticket
- If retry fails 2x → Change strategy
- If strategy 3 fails → Escalate

## When to Abort

- Security issue confirmed
- Coverage drop from 78% to 72%
- Max iterations (3) exceeded
- Budget limit ($400) reached
```

#### Django/Python
```markdown
# Governance & Recovery Policy - MyApp

## Hard Rules (Never Violated)

1. **Forbidden Zones**: migrations/, settings.py structure, manage.py core
2. **Security**: Django security checks must pass
3. **Build**: Python syntax valid (pylint/black/mypy)
4. **Tests**: pytest tests pass, coverage ≥ 85%
5. **Budget**: Never exceed $300/month
6. **Database**: Schema changes only via migrations

## Escalation Triggers

- Forbidden zone modification
- Django security warning
- Python syntax error
- pytest failure
- Coverage drop > 5%
- Migration creation requested
- ORM query change (breaking)

## Recovery Strategy

- Max 3 iterations
- Retry → Re-plan → Simplify
- If all fail → Escalate

## When to Abort

- Security issue
- Max retries (3x) exceeded
- Budget exceeded
```

---

## Quick Reference: Which File Does What?

| File | Controls | Changed When |
|------|----------|--------------|
| **`.env`** | LLM provider, budget, mode | New project, new API key, budget change |
| **`backlog.json`** | Which tickets to process | New task arrives, updating existing ticket |
| **`forbidden-zones.md`** | What can't be modified | Discover new risky area, security incident |
| **`patterns.md`** | How code should look | Team changes conventions, framework update |
| **`policy.md`** | When to escalate | After first failed ticket, policy change |

---

## ✅ Validation Checklist

After filling all files:

```bash
# 1. Check .env syntax and required keys
grep -E "^(ANTHROPIC_API_KEY|OPENAI_API_KEY|HARNESS_MODE)" harness/.env

# 2. Validate JSON syntax
cat harness/backlog.json | jq .

# 3. Verify markdown files exist
ls -la .harness/{rules,architecture,governance}/*.md

# 4. Check first ticket format
cat harness/backlog.json | jq '.tickets[0]'

# 5. Syntax check
cd harness && npm run typecheck

# 6. First test (optional)
HARNESS_MODE=deterministic npm run dev
```

All checks should pass ✅

---

## 🎓 Next Steps

1. **Fill all 5 files** (use examples above)
2. **Run validation** (checklist above)
3. **Review .harness/ files** (make sure they match your project)
4. **Create first ticket** in backlog.json
5. **Test**: `npm run dev`
6. **Create more tickets** as needed

---

**Status:** Complete Configuration Reference  
**Last Updated:** 2026-07-30  

