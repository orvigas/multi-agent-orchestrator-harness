# 🧙 Multi-Agent Harness Setup Wizard

**Loop-Engineering Based Interactive Configuration**

> This document is designed to be executed by an AI agent. It contains:
> - Interactive questions to gather project context
> - Decision trees based on answers
> - Automatic configuration generation
> - First ticket creation walkthrough
> - Development kickstart guide

**Time to complete:** 30-45 minutes  
**Outcome:** Fully configured harness + first ticket ready to execute

---

## Phase 1: Project Discovery

Use this section to understand the target project. Ask the user each question in order.

### Question 1.1: Project Name & Description

```
Q: What is your project called, and what does it do?
   Example: "MyApp - An e-commerce platform for handmade goods"
   
ACTION: Store as <PROJECT_NAME> and <PROJECT_DESCRIPTION>
```

**Why:** Personalize configuration and context docs.

---

### Question 1.2: Primary Programming Language

```
Q: What is the primary language of your codebase?

OPTIONS:
  a) TypeScript / JavaScript (Node.js)
  b) Python
  c) Java
  d) Go
  e) Rust
  f) C# / .NET
  g) Other (specify)

ACTION: Store as <PRIMARY_LANG>
        Load language-specific patterns
```

**Why:** Determines parser, validator, test-runner to use.

---

### Question 1.3: Main Web Framework (if applicable)

```
Q: What is your primary web framework?

IF <PRIMARY_LANG> == TypeScript:
  OPTIONS:
    a) Express.js
    b) NestJS
    c) Next.js (full-stack)
    d) Fastify
    e) Other
    
IF <PRIMARY_LANG> == Python:
  OPTIONS:
    a) Django
    b) FastAPI
    c) Flask
    d) Other
    
IF <PRIMARY_LANG> == Java:
  OPTIONS:
    a) Spring Boot
    b) Quarkus
    c) Other
    
IF <PRIMARY_LANG> == Go:
  OPTIONS:
    a) Gin
    b) Echo
    c) Chi
    d) Other

ACTION: Store as <FRAMEWORK>
        Load framework patterns
```

**Why:** Framework patterns guide code generation.

---

### Question 1.4: Project Structure

```
Q: Show your current project structure (first 3 levels).
   Example output:
   my-app/
   ├── src/
   │   ├── controllers/
   │   ├── services/
   │   ├── models/
   │   ├── utils/
   │   └── middleware/
   ├── tests/
   ├── config/
   ├── package.json
   └── README.md

ACTION: Store as <CURRENT_STRUCTURE>
        Analyze against best practices
        Suggest improvements if needed
```

**Why:** Tailor forbidden zones and architecture docs.

---

### Question 1.5: Code Quality & Testing Practices

```
Q: How do you currently handle testing and code quality?

CHECKBOXES (select all that apply):
  ☐ Unit tests (framework: _______)
  ☐ Integration tests
  ☐ E2E tests
  ☐ Linting (tool: _______)
  ☐ Type checking (TypeScript, Mypy, etc.)
  ☐ Code coverage tracking
  ☐ CI/CD pipeline

Estimate current coverage: _____% (or "unknown")

ACTION: Store as <TEST_STACK>
        Store as <COVERAGE>
        Configure validation pipeline expectations
```

**Why:** Validation pipeline respects your existing quality gates.

---

### Question 1.6: Architectural Patterns & Constraints

```
Q: What architectural patterns or constraints should the harness respect?

FREEFORM (2-3 key points):
  Example:
  - "Monolithic MVC, no microservices"
  - "Domain-driven design, bounded contexts by folder"
  - "Functional programming, no class-based code"
  - "Event-driven architecture with message queues"
  - "Must support multi-tenancy"

ACTION: Store as <ARCHITECTURE_NOTES>
        Generate architecture.md based on this
```

**Why:** Creates `.harness/architecture/` rules unique to your project.

---

### Question 1.7: Sensitive Areas & Restrictions

```
Q: What parts of your codebase are FORBIDDEN to modify?

Examples (check all that apply):
  ☐ Database migrations (migrations/)
  ☐ CI/CD configuration (.github/workflows/)
  ☐ Infrastructure code (terraform/, k8s/)
  ☐ Security/auth core (src/auth/)
  ☐ Billing/payment system
  ☐ Legacy code (legacy/ folder)
  ☐ Third-party integrations

FREEFORM (if not covered above):
  ______________________________________

ACTION: Store as <FORBIDDEN_ZONES>
        Generate rules.md with specific paths
```

**Why:** Safety first - prevent harness from touching critical code.

---

### Question 1.8: Development Workflow & Conventions

```
Q: What are your team's coding conventions?

MULTIPLE CHOICE (per language):

IF TypeScript:
  • Naming: camelCase | PascalCase | snake_case
  • File org: By feature | By layer | Other: _____
  • Error handling: try/catch | Result types | Other: _____
  • Testing: Jest | Vitest | Mocha | Other: _____

IF Python:
  • Naming: snake_case | PascalCase | Other
  • Testing: pytest | unittest | Other
  • Type hints: Always | When complex | Optional
  
IF Java:
  • Testing: JUnit | TestNG | Other
  • Build: Maven | Gradle | Other
  • Patterns: Spring patterns | Other conventions

FREEFORM: Any special conventions?
  ______________________________________

ACTION: Store as <CODE_CONVENTIONS>
        Use for code generation heuristics
```

**Why:** Generated code matches team style.

---

### Question 1.9: Team Size & Deployment Strategy

```
Q: What is your team size and deployment frequency?

Team size: ☐ Solo | ☐ 2-5 | ☐ 5-15 | ☐ 15+

Deployment:
  ☐ Manual (on demand)
  ☐ Daily
  ☐ Multiple times per day (CI/CD)
  ☐ Automated on merge

Current CI/CD: _______________________
  (GitHub Actions, GitLab CI, Jenkins, etc.)

ACTION: Store as <TEAM_SIZE>
        Store as <DEPLOYMENT_FREQ>
        Store as <CI_CD_TOOL>
```

**Why:** Helps calibrate recovery strategy aggressiveness.

---

## Phase 2: API Key & Environment Setup

### Question 2.1: LLM Provider Selection

```
Q: Which LLM provider do you want to use for the harness?

PRIMARY (required):
  ☐ Anthropic Claude (recommended)
  ☐ OpenAI GPT-4
  ☐ OpenRouter (proxy)

FALLBACK (optional):
  ☐ None
  ☐ Use secondary provider

ACTION: Store as <PRIMARY_PROVIDER>
        Store as <FALLBACK_PROVIDER>
        Generate harness/config/providers.yml accordingly
```

**Why:** Determines LLM infrastructure and cost.

---

### Question 2.2: API Key Provision

```
Q: Do you have API key(s) ready?

IF selected Anthropic:
  "Get key at: https://console.anthropic.com/account/keys"
  Paste key (will not be displayed): ___________________

IF selected OpenAI:
  "Get key at: https://platform.openai.com/account/api-keys"
  Paste key: ___________________

IF selected OpenRouter:
  "Get key at: https://openrouter.ai/keys"
  Paste key: ___________________

ACTION: Create harness/.env with:
  PRIMARY_API_KEY=<key>
  HARNESS_MODE=deterministic  (for first test)
  (Mark .env as gitignored, do NOT commit)
```

**Why:** Ready to test immediately.

---

### Question 2.3: Budget & Cost Constraints

```
Q: What's your monthly LLM budget?

Monthly budget (USD): $____
  Suggested: $100-500 for testing, $500+ for production

Hard limit (USD): $____
  (Harness will abort if exceeded)

Preferred model tier (when over budget):
  ☐ Keep current model (cost matters)
  ☐ Downgrade to cheaper model (Opus→Sonnet→Haiku)
  ☐ Abort (never degrade)

ACTION: Store as <BUDGET>
        Store as <HARD_LIMIT>
        Store as <DOWNGRADE_STRATEGY>
        Configure tokenBudgetEnforcer accordingly
```

**Why:** Prevents bill shock, enables cost-aware decisions.

---

## Phase 3: Knowledge Engine Configuration

### Question 3.1: Evidence Retrieval Strategy

```
Q: What size is your codebase?

File count: 
  ☐ < 100 files
  ☐ 100-500 files
  ☐ 500-2000 files
  ☐ 2000+ files

Estimated lines of code:
  ☐ < 10K
  ☐ 10K-50K
  ☐ 50K-200K
  ☐ 200K+

ACTION: Store as <CODEBASE_SIZE>
        Calibrate Knowledge Engine search depth
        Adjust TF-IDF vector index strategy
```

**Why:** Affects search performance and evidence quality.

---

### Question 3.2: Key Files & Patterns

```
Q: What are the key files/folders the harness should focus on?

EXAMPLES (your project specific):
  • Config files: src/config/, config.yml
  • Data models: src/models/, schema.ts
  • API routes: src/routes/, controllers/
  • Utils: src/utils/, helpers/
  • Business logic: src/services/, business/

YOUR KEY LOCATIONS:
  ____________________________________
  ____________________________________
  ____________________________________

ACTION: Store as <KEY_LOCATIONS>
        Create .harness/architecture/key-files.md
```

**Why:** Knowledge Engine prioritizes relevant code.

---

## Phase 4: Forbidden Zones & Governance

### Question 4.1: Generate Rules Document

Based on answers from 1.7 and 1.4, create:

```markdown
# harness/rules/forbidden-zones.md

## Absolute Forbidden Zones

### Security & Secrets
- secrets/
- .env*
- **/*.pem, **/*.key
- **/*.json (if contains credentials)

### Infrastructure
- .github/workflows/       [WHY: CI/CD changes need approval]
- terraform/ (if exists)  [WHY: IaC requires change control]
- docker/ (if exists)     [WHY: Container changes need review]
- k8s/ (if exists)        [WHY: Kubernetes manifests]

### <PROJECT_SPECIFIC>
<FROM QUESTION 1.7>

## Conditional (Requires Review)

### Database
- database/migrations/     [WHY: Schema changes need backward-compat review]
- schema.sql / schema.ts   [WHY: Data model changes]

### Auth/Security
- src/auth/ (if exists)    [WHY: Security critical]
- src/security/ (if exists)

### Package Management
- package.json (dependencies only)
  [WHY: Can modify versions of existing deps, cannot add new]
- requirements.txt (Python)
- go.mod (Go)

## Why This Matters

The harness respects these zones ABSOLUTELY. No exceptions.
If a ticket requires modifying forbidden zones → automatic escalation to human review.
```

**Why:** Safety gates for critical code.

---

### Question 4.2: Generate Architecture Document

Based on 1.6 and code conventions:

```markdown
# harness/architecture/patterns.md

## Project: <PROJECT_NAME>

### Architecture Overview
<FROM QUESTION 1.6>

### Coding Patterns

**Language:** <PRIMARY_LANG>
**Framework:** <FRAMEWORK>

#### Naming Conventions
<FROM QUESTION 1.8>
- Classes: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: index.ts (barrel), feature.ts (module)

#### File Organization
<FROM QUESTION 1.4>
```
<CURRENT_STRUCTURE_FORMATTED>
```

Best practices:
- Keep files < 300 lines
- One responsibility per file
- Colocate tests (*.test.ts)

#### Error Handling
- Pattern: <TRY/CATCH OR RESULT TYPES>
- Convention: Throw or return?
- HTTP status codes: Follow RFC standards

#### Testing Strategy
- Test type: <UNIT | INTEGRATION | E2E>
- Framework: <FRAMEWORK>
- Coverage target: <COVERAGE>%
- Mocking: <REAL OBJECTS | MOCKS>

### Sensitive Areas

**DO NOT MODIFY:**
<FROM QUESTION 1.7>

**EXERCISE CAUTION:**
<CONDITIONAL ZONES>

### Design Decisions

Key decisions documented here to guide code generation:
1. <DECISION 1>
2. <DECISION 2>
3. <DECISION 3>
```

**Why:** Encodes project-specific knowledge.

---

### Question 4.3: Generate Governance Document

```markdown
# harness/governance/policy.md

## Recovery Loop Policy

### Reglas Duras (Never Violated)

1. **Forbidden Zones:** NEVER modify <FORBIDDEN_ZONES>
2. **Security:** If npm audit finds severity >= HIGH → Always escalate
3. **Build:** Compilation must pass (tsc, javac, etc.)
4. **Tests:** Existing tests must pass
5. **Budget:** Never exceed $<HARD_LIMIT> / month

### Escalation Triggers

When these occur → Manual human review required:

- [ ] Forbidden zone violation
- [ ] Security issue found (npm audit, cargo audit, etc.)
- [ ] Merge conflict
- [ ] Build failure after 2 retry strategies
- [ ] Architecture violation
- [ ] Coverage drop > 5%

### Recovery Strategy Limits

- Max recovery iterations per ticket: 3
- Max retries per strategy: 2
- If repeated failure → Force strategy change

### When to Abort

- Security risk confirmed
- Merge conflict unresolvable
- Architecture violation
- Budget exceeded
- Max iterations exceeded

### Model Downgrade Strategy

Current: <DOWNGRADE_STRATEGY>
- If budget > 80% → Try cheaper model
- If budget > 95% → Alert, then abort
```

**Why:** Encodes safety policies.

---

## Phase 5: First Ticket Walkthrough

### Question 5.1: Define Example Ticket Type

```
Q: What kind of task do you want to handle first?

OPTIONS:
  ☐ Bug Fix (existing issue)
  ☐ Feature Addition (new capability)
  ☐ Refactoring (improve existing code)
  ☐ Documentation (update docs)

ACTION: Store as <FIRST_TICKET_TYPE>
        Show appropriate example template
```

---

### Question 5.2: Create First Example Ticket

Based on <FIRST_TICKET_TYPE>, create example:

#### If Bug Fix:

```json
{
  "ticketId": "BUG-1",
  "title": "Example: Fix null pointer in <CommonFunction>",
  "description": "When <SomeCondition> occurs, function throws NullPointerException",
  "targetRepoPath": "<YOUR_REPO_PATH>",
  "priority": "high",
  "requirements": "Investigate null pointer in src/services/<Service>.ts:

1. Find where null can occur
2. Add null check or validation
3. Return meaningful error if null
4. Add test case for this scenario
5. Ensure error handling is consistent

Constraints:
- Do NOT change function signature
- MUST pass existing tests
- Update error types if needed",
  "context": "Related to issue #123"
}
```

#### If Feature:

```json
{
  "ticketId": "FEAT-1",
  "title": "Example: Add <FeatureName> API endpoint",
  "description": "Need new endpoint to expose <Capability>",
  "targetRepoPath": "<YOUR_REPO_PATH>",
  "priority": "normal",
  "requirements": "Implement new API endpoint:

1. Create endpoint: GET /api/<resource>/list
2. Add authentication check
3. Return paginated results
4. Add validation for query params
5. Document in API spec
6. Add unit + integration tests

Technical details:
- Framework: <FRAMEWORK>
- Response format: JSON (see spec)
- Error codes: 400, 401, 404, 500
- Rate limit: [if applicable]

Acceptance criteria:
- Endpoint works with existing auth
- Returns correct pagination
- All tests pass",
  "context": "Sprint backlog item SPRINT-45"
}
```

**Why:** Shows exact format + context-sensitive example.

---

### Question 5.3: Backlog Creation

```
Q: Create your first backlog.json

ACTION:
1. Generate template:

   harness/backlog.json:
   ------
   {
     "tickets": [
       <EXAMPLE_TICKET_FROM_5.2>
     ],
     "metadata": {
       "createdAt": "2026-07-30T10:00:00Z",
       "projectName": "<PROJECT_NAME>",
       "targetRepoPath": "<TARGET_REPO_PATH>"
     }
   }
   ------

2. Help user customize:
   Q: Edit the example ticket to match YOUR project:
   - Change ticketId to your ticket ID format
   - Update the title to your feature/bug
   - Adjust description
   - Update requirements with YOUR specific needs
   - Set correct targetRepoPath

3. Validate:
   "Does this ticket JSON make sense for your project?"
   If NO → Go back and edit
   If YES → Continue to Phase 6
```

**Why:** First ticket is the hardest - provide template.

---

## Phase 6: Test Run & Validation

### Question 6.1: Environment Verification

```
Q: Let's verify your setup before running the harness.

ACTION: Create checklist script for user:

  Checklist (run each):
  
  ✓ cd harness
  ✓ npm install
      Expected: "added X packages"
  
  ✓ npm run typecheck
      Expected: "No errors" or "No changes"
  
  ✓ ls -la .env
      Expected: ".env exists"
  
  ✓ cat config/providers.yml | grep -i "anthropic\|openai"
      Expected: Your chosen provider configured
  
  ✓ cat ../backlog.json | head -20
      Expected: Your first ticket visible

If all pass → Continue
If any fail → Troubleshoot before proceeding
```

---

### Question 6.2: First Test Run (Deterministic Mode)

```
Q: Ready to run the harness for the first time?

Running in DETERMINISTIC MODE (no LLM calls, no costs):

  cd harness
  HARNESS_MODE=deterministic npm run dev

This will:
  1. Load your configuration
  2. Read backlog.json
  3. Process your first ticket with heuristics
  4. Create SQLite checkpoint database
  5. Output decision logs

Expected output:
  [Knowledge Engine] Searching for evidence...
  [Planner] Creating plan with X tasks...
  [Implementation] Generating patches...
  [Validation] Running tests...
  [Recovery] (skip if no failures)
  [Quality Gate] Checking coverage...
  [Merge Manager] Merging results...

Watch for:
  ✓ "Successfully processed ticket BUG-1"
  ✗ Any errors or escalations
  ⚠️ Warnings (still proceeds)

ACTION: Run and capture output
```

---

### Question 6.3: Interpret Results

```
Q: The harness has finished. Let's interpret the results.

ACTION: Show results section:

  View logs:
    npm run logs

  View costs (if LLM mode):
    npm run costs

  Check database:
    sqlite3 data/harness-checkpoints.db
    SELECT * FROM checkpoint_state LIMIT 1;

Results interpretation:
  
  ✅ SUCCESS (ticket fully processed):
     - Patches generated
     - All validations passed
     - Ready to merge
     - Next: Review changes, commit to your repo
  
  ⚠️ NEEDS REVIEW (escalated):
     - Issue found that needs human decision
     - Next: Review .harness/escalations/ folder
     - Make decision, then retry
  
  ❌ FAILED (could not complete):
     - Check logs for error type
     - Adjust ticket requirements if unclear
     - Retry with simpler scope
```

---

## Phase 7: LLM Mode Activation (Optional)

### Question 7.1: Ready for Real AI?

```
Q: Want to switch to LLM mode with real Claude API?

This will:
  ✓ Use actual Claude for planning/implementation
  ✓ Cost $0.10-$2.00 per ticket (depends on complexity)
  ✓ Be much more intelligent/flexible
  ✗ Require valid API key
  ✗ Consume your budget

If YES:
  1. Update harness/.env:
     HARNESS_MODE=llm
  
  2. Verify API key is set:
     echo $ANTHROPIC_API_KEY
  
  3. Rerun with LLM:
     npm run dev
  
  4. Monitor costs:
     npm run costs
```

---

## Phase 8: Development Workflow & Next Steps

### Question 8.1: Ticket Creation Workflow

```
Q: Here's how to create tickets going forward:

For each new task:

1. CAPTURE REQUIREMENT
   User tells you: "Add email validation to login"
   
2. UNDERSTAND CONTEXT
   Ask: "What email format? Where should it validate?
        Do we need to update tests?"
   
3. CREATE TICKET JSON
   {
     "ticketId": "TASK-N",
     "title": "Add email validation to LoginService",
     "description": "Users can input invalid emails",
     "requirements": "Find LoginService email regex.
                     Update to RFC 5322 compliant.
                     Add edge cases tests.",
     "targetRepoPath": "/path/to/your/repo",
     "priority": "normal"
   }

4. ADD TO BACKLOG
   vim harness/backlog.json
   # Add your ticket to "tickets" array

5. EXECUTE
   cd harness && npm run dev

6. MONITOR
   npm run logs    # See decisions
   npm run costs   # See LLM costs

7. REVIEW
   Changes are in your target repo
   Review the patches, commit if good
```

---

### Question 8.2: Common Patterns by Technology

#### IF <PRIMARY_LANG> == TypeScript && <FRAMEWORK> == NestJS

```
## NestJS Patterns - Harness Best Practices

The harness understands:
- Module structure (imports/providers)
- Dependency injection patterns
- DTOs for validation
- Controllers/Services/Repositories
- Decorators (@Controller, @Post, etc.)
- Error handling (HttpException)
- Testing (Jest structure)

When creating tickets:
- "Add POST /users endpoint with validation"
  → Harness will create: controller, service, DTO, tests
  
- "Fix validation in UserService"
  → Harness will find the service, update logic, add tests
  
- "Add logging middleware"
  → Harness will create middleware, register in module

Constraints the harness respects:
- Modules must be in src/modules/<name>
- Services in src/services/ or <module>/services
- Controllers export via modules
- Tests use .spec.ts convention
- Avoid circular dependencies
```

#### IF <PRIMARY_LANG> == Python && <FRAMEWORK> == Django

```
## Django Patterns - Harness Best Practices

The harness understands:
- Model definitions (ORM)
- View functions/classes
- URL routing
- Forms & validation
- Middleware
- Django ORM queries
- Migration structure
- Testing patterns (pytest, unittest)

When creating tickets:
- "Add User email field with validation"
  → Harness will: update model, create migration, update forms, test
  
- "Fix N+1 query in user list view"
  → Harness will: find view, add select_related/prefetch_related, test
  
- "Add rate limiting middleware"
  → Harness will: create middleware, register in MIDDLEWARE

Constraints:
- Migrations are FORBIDDEN (handled by ops team)
- Settings changes need review (manage.py)
- Database queries must respect ORM
- Tests use pytest or unittest convention
```

#### IF <PRIMARY_LANG> == Java && <FRAMEWORK> == Spring Boot

```
## Spring Boot Patterns - Harness Best Practices

The harness understands:
- @RestController, @Controller annotations
- @Service, @Repository patterns
- @Entity JPA models
- Dependency injection (@Autowired, constructor)
- @RequestMapping/@PostMapping routes
- Exception handlers (@ExceptionHandler)
- Test structure (JUnit, Mockito)
- Configuration classes (@Configuration)

When creating tickets:
- "Add POST /api/users endpoint"
  → Harness will: create controller, service, entity, test
  
- "Fix null pointer in UserService"
  → Harness will: find service, add null checks, update tests
  
- "Add request logging filter"
  → Harness will: create filter, register in config, test

Constraints:
- Database migrations require DBA review
- Security filters need careful auditing
- Configuration changes need approval
- Tests use JUnit 5 convention
```

---

### Question 8.3: Troubleshooting Common Issues

```
## If something goes wrong:

### "Harness generated code that doesn't compile"
  → Recovery loop will catch this
  → Manual: Review logs, understand issue
  → Simplify requirements for next attempt
  → Retry with clearer specification

### "Generated tests failed"
  → Validation pipeline will fail
  → Check what failed (logs show exact error)
  → Recovery loop suggests fix strategy
  → Manual: Review suggestion, retry or escalate

### "Changes don't match my style"
  → Check .harness/architecture/patterns.md
  → Update to match your conventions
  → Regenerate ticket with updated patterns
  → Retry

### "I don't trust the changes"
  → All changes are in backlog-generated JSON
  → Review patch before committing
  → You control merge (manual review)
  → Harness cannot auto-commit
  
### "It's too slow"
  → Check codebase size (Q3.1)
  → Increase Knowledge Engine search depth
  → Provide key locations (Q3.2)
  → Consider splitting into smaller tickets

### "Budget is being consumed too fast"
  → Check current run costs: npm run costs
  → Switch to HARNESS_MODE=deterministic for testing
  → Simplify requirements (smaller scope)
  → Use cheaper model via downgrade strategy
```

---

## Phase 9: Continuous Improvement

### Question 9.1: Metrics & Feedback

```
Q: After your first few tickets, measure:

  ✓ Success rate: What % of tickets succeeded without escalation?
  ✓ Time to merge: How long from ticket to merged code?
  ✓ Cost per ticket: Track in npm run costs
  ✓ Quality: Any bugs in merged code? Any test failures?

Track this over time:
  Ticket 1: Success (yes/no), Time: XX min, Cost: $X.XX
  Ticket 2: Success (yes/no), Time: XX min, Cost: $X.XX
  Ticket 3: ...

If success rate < 50%:
  → Improve requirements (be more specific)
  → Check .harness/ patterns match your code
  → Use simpler tickets as warm-up

If cost is too high:
  → Switch to cheaper model
  → Reduce ticket scope
  → Use deterministic mode for testing
```

---

### Question 9.2: Iterate on .harness/ Configuration

```
After each ticket, refine:

✓ .harness/rules/forbidden-zones.md
  "Did we try to modify something we shouldn't have?"
  → Add that path to forbidden list

✓ .harness/architecture/patterns.md
  "Did harness generate code that didn't match our style?"
  → Add/clarify pattern rules

✓ .harness/governance/policy.md
  "Should we escalate different things?"
  → Update escalation triggers

This makes the harness smarter over time.
```

---

## Output: Generated Files

After completing all phases, generate:

### 1. Configuration Files

```
harness/.env
  ANTHROPIC_API_KEY=<key>
  HARNESS_MODE=deterministic
  CHECKPOINT_DB_PATH=./data/harness-checkpoints.db

harness/config/providers.yml
  <CUSTOMIZED FOR <PRIMARY_PROVIDER>>

harness/backlog.json
  <FIRST TICKET EXAMPLE>
```

### 2. Context Files

```
.harness/rules/forbidden-zones.md
  <GENERATED FROM QUESTION 1.7>

.harness/architecture/patterns.md
  <GENERATED FROM QUESTIONS 1.6, 1.8, 8.2>

.harness/architecture/key-files.md
  <GENERATED FROM QUESTION 3.2>

.harness/governance/policy.md
  <GENERATED FROM QUESTION 4.3>
```

### 3. Checklist

```
✅ Setup Complete Checklist

 [✓] Node.js v18+ installed
 [✓] harness/npm install complete
 [✓] harness/.env configured
 [✓] API key tested (or deterministic mode ready)
 [✓] .harness/ context files created
 [✓] First ticket created in backlog.json
 [✓] First test run successful (deterministic mode)
 [✓] Ready to create more tickets!

Next steps:
  1. Review generated .harness/ files
  2. Adjust .harness/architecture/patterns.md to match YOUR style
  3. Create 2-3 more tickets to calibrate
  4. Switch to LLM mode when confident
  5. Monitor costs and success rate
  6. Iterate on configuration based on results
```

---

## Loop Summary

| Phase | Input | Output | Time |
|-------|-------|--------|------|
| 1 | Project questions | Project understanding | 15 min |
| 2 | API key, budget | .env setup | 5 min |
| 3 | Codebase info | KE configuration | 5 min |
| 4 | Constraints | .harness/ files | 5 min |
| 5 | Ticket type | Example backlog.json | 5 min |
| 6 | Environment | First test run | 10 min |
| 7 | Budget approval | LLM activation | 2 min |
| 8 | Patterns | Workflow guide | 5 min |
| 9 | Feedback | Improvement plan | 3 min |
| **Total** | | | **~55 min** |

---

## For AI Agents Reading This

**When user asks "Set up the harness for my new project":**

1. START HERE → Begin Phase 1
2. ASK EACH QUESTION in order (1.1, 1.2, 1.3, etc.)
3. STORE ANSWERS in a structured format
4. GENERATE OUTPUT files based on answers
5. VALIDATE each phase before proceeding
6. GUIDE USER through first test run
7. PROVIDE troubleshooting at each step
8. END with checklist and next steps

**Key principle:** This is a dialog-based configuration wizard. Each question unlocks the next level of configuration. Do not skip phases.

---

**Last Updated:** 2026-07-30  
**Status:** Ready for Production  
**Estimated Setup Time:** 45-60 minutes to fully operational

