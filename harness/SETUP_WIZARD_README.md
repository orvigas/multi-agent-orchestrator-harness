# 🧙 Setup Wizard — Complete Interactive Configuration System

**Loop-engineered interactive guide for configuring the harness on any new project**

---

## 📦 What You Got

Three complimentary documents:

### 1. **`SETUP_WIZARD.md`** (The Full Guide)
- 9 phases of configuration
- Every question explained
- Decision trees for different tech stacks
- Automatic file generation logic
- Instructions for AI agents

**Read this if:** You're implementing the wizard or need to understand every step

---

### 2. **`setup-wizard.sh`** (The Automated Script)
- Bash script that implements the wizard
- Interactive prompts for each question
- Automatic file generation (.env, backlog.json, .harness/*)
- Color-coded output (green=success, yellow=questions, red=errors)
- Environment validation

**Run this if:** You want to set up a real project

---

### 3. **`SETUP_WIZARD_TEST.md`** (The Example)
- Complete walkthrough with example project (TechShop - NestJS e-commerce)
- Every Q&A shown with realistic answers
- Generated files demonstrated
- Expected orchestrator output (first ticket run)
- What happens behind the scenes

**Read this if:** You want to see what the experience feels like before running it

---

## 🚀 Quick Start

### Option A: Interactive Script (Recommended for First-Time Users)

```bash
cd harness
bash setup-wizard.sh
```

The script will:
1. Ask 20+ questions interactively
2. Generate configuration files automatically
3. Create `.harness/` context files
4. Generate your first ticket
5. Optionally run first test

**Time:** ~45-60 minutes

### Option B: Read Everything First (Recommended for Understanding)

```bash
# Read in order:
1. Read: SETUP_WIZARD.md (phases 1-9)
2. Read: SETUP_WIZARD_TEST.md (example walkthrough)
3. Run: setup-wizard.sh (with your project info)
```

**Time:** ~1 hour total (including reading)

### Option C: For AI Agents

If an AI agent is setting up the harness for you:

1. Agent reads: `SETUP_WIZARD.md`
2. Agent asks you: Each question in order
3. Agent generates: All files automatically
4. Agent validates: Checks everything works
5. Result: Harness fully configured

---

## 📋 What Gets Generated

### Configuration Files

```
harness/
├── .env                           ← LLM provider, budget, database path
├── backlog.json                   ← Your first ticket (ready to execute)
└── config/
    └── providers.yml              ← LLM models & costs (customized)

.harness/
├── rules/
│   └── forbidden-zones.md         ← What harness CANNOT modify
├── architecture/
│   ├── patterns.md                ← Your project's code patterns
│   └── key-files.md               ← Important files to prioritize
└── governance/
    └── policy.md                  ← Safety rules & escalation triggers
```

### Generated Content Examples

**`.harness/rules/forbidden-zones.md`:**
```markdown
# Forbidden Zones

## Absolute
- secrets/, .env*, *.pem, *.key
- database/migrations/
- .github/workflows/
- src/auth/ (if your project has it)

## Why This Matters
The harness respects these ABSOLUTELY.
```

**`.harness/architecture/patterns.md`:**
```markdown
# Architecture & Patterns

## Project: YourProject
- Language: TypeScript
- Framework: NestJS
- Team size: 5-10 people

## Module Structure
src/modules/[domain]/
├── controllers/
├── services/
├── entities/
├── dtos/
└── *.spec.ts (tests)

## When Generating Code
1. Match language conventions
2. Follow existing patterns
3. Respect framework idioms
```

---

## 🎯 What the Wizard Asks (Quick Reference)

| Phase | Questions | Purpose |
|-------|-----------|---------|
| **1** | Project name, language, framework, structure | Understand your tech stack |
| **2** | Testing practices, code quality tools | Configure validation |
| **3** | Architecture, patterns, conventions | Guide code generation |
| **4** | Forbidden zones, sensitive areas | Prevent dangerous changes |
| **5** | Evidence retrieval strategy, key locations | Tune Knowledge Engine |
| **6** | LLM provider, API key, budget | Set up LLM infrastructure |
| **7** | Ticket type, create first example | Prepare first execution |
| **8** | Verification checklist | Validate setup |
| **9** | Optional: First test run | Confirm everything works |

---

## 💡 How It Works

### Loops & Decision Trees

The wizard uses **loop-engineering techniques:**

1. **Sequential Phases**: Each phase unlocks the next
2. **Conditional Questions**: Answers change later questions
   - "TypeScript?" → Ask about NestJS, Express, etc.
   - "Python?" → Ask about Django, FastAPI, etc.
3. **Decision Trees**: Different paths for different stacks
4. **Feedback Loops**: Validation at each step
5. **Knowledge Encoding**: Answers → configuration files

### Context Generation

Answers are automatically converted to:

```
User answers (Q&A)
        ↓
Structured data
        ↓
Context files (.harness/)
        ↓
LLM-readable patterns
        ↓
Code generation guidance
```

Example:
```
Q: What framework?
A: NestJS

Auto-generates:
✓ patterns.md knows @Controller, @Service, @Module
✓ Recognizes DTO validation patterns
✓ Expects .spec.ts test files
✓ Knows Module imports/exports structure
```

---

## 🛠️ Using the Script

### Basic Usage

```bash
cd harness
bash setup-wizard.sh
```

### What Each Prompt Looks Like

```
═══════════════════════════════════════════════════════
PHASE 1: PROJECT DISCOVERY
═══════════════════════════════════════════════════════

Q1.1: What is your project called?
Example: 'MyApp - An e-commerce platform'

> TechShop - E-commerce platform for gadgets
✓ Language: typescript
```

### Interactive Selection

```
Q1.2: What is the primary language?

Select (1-7):
  1) TypeScript/JavaScript
  2) Python
  3) Java
  4) Go
  5) Rust
  6) C#/.NET
  7) Other

> 1
✓ Language: typescript
```

### Checkbox-Style Input

```
Q1.5: Testing & Code Quality (select all that apply)

a) Unit tests (framework?)
b) Integration tests
c) E2E tests
d) Linting
e) Type checking
f) Code coverage

> a,b,d,e,f
✓ QA Stack noted
```

---

## 📊 Configuration Matrix

The wizard adapts to your tech stack:

### TypeScript + NestJS

```
Generated patterns:
✓ Module/Controller/Service/Entity/DTO structure
✓ @Injectable(), @Controller() decorators
✓ Dependency injection patterns
✓ Jest test structure
✓ TypeORM queries
```

### Python + Django

```
Generated patterns:
✓ Models/Views/URLs structure
✓ Django ORM patterns
✓ Django management commands
✓ pytest/unittest
✓ Settings configuration
```

### Java + Spring Boot

```
Generated patterns:
✓ @RestController, @Service patterns
✓ Dependency injection (@Autowired)
✓ JPA entities
✓ Repository pattern
✓ JUnit/Mockito tests
```

### Go + Gin

```
Generated patterns:
✓ Gin router patterns
✓ Handler structure
✓ Middleware
✓ Error handling
✓ Testing with testify
```

---

## ✅ Verification Steps

After running the script, check:

```bash
# 1. .env exists
ls -la harness/.env

# 2. backlog.json has your ticket
cat harness/backlog.json | jq '.tickets[0].title'

# 3. .harness/ files created
ls -la .harness/{rules,architecture,governance}

# 4. Configuration is valid
npm run typecheck

# 5. First test (optional)
HARNESS_MODE=deterministic npm run dev
```

---

## 🔧 Troubleshooting Setup

### "Command not found: bash setup-wizard.sh"

```bash
# Make script executable
chmod +x setup-wizard.sh

# Then run
./setup-wizard.sh
```

### "npm: command not found"

```bash
# Install Node.js from https://nodejs.org/
node --version  # Should be v18+
npm --version   # Should be 9+
```

### ".env file has wrong API key"

```bash
# Edit manually
vim .env
# Update ANTHROPIC_API_KEY=sk-ant-v0-...
```

### "backlog.json looks wrong"

```bash
# Edit template
vim backlog.json

# Fix your ticket JSON and retry
npm run dev
```

---

## 🎓 Learning Resources

| Document | Purpose |
|----------|---------|
| **SETUP_WIZARD.md** | Complete reference guide with all questions |
| **SETUP_WIZARD_TEST.md** | Real-world example (NestJS e-commerce) |
| **setup-wizard.sh** | Automated implementation |
| **../docs/GETTING_STARTED.md** | Manual setup (no script) |
| **../docs/REQUIREMENTS_CAPTURE.md** | Creating more tickets after first setup |
| **../DOCUMENTATION_INDEX.md** | Find everything |

---

## 🤖 For AI Agents

If you're an AI reading this to set up a project:

### Required Knowledge
1. Read `SETUP_WIZARD.md` completely (understand all 9 phases)
2. Study `SETUP_WIZARD_TEST.md` (see realistic example)
3. Understand tech-stack detection logic
4. Know how to generate context files

### Execution Steps
1. **Ask questions in order** (phases 1-9)
2. **Validate answers** (catch inconsistencies)
3. **Generate files** based on answers
4. **Validate files** (check syntax, completeness)
5. **Run verification** (npm run typecheck, etc.)
6. **Guide first test** (npm run dev)
7. **Provide next steps** (how to create more tickets)

### Example Dialogue

```
Agent: What is your project called?
User: MyAPI - REST API for booking system

Agent: What language?
User: TypeScript

Agent: Framework?
User: Express.js

[Agent analyzes answers, detects Express.js patterns]
[Agent generates patterns.md with Express conventions]
[Agent creates .env with correct structure]
[Agent generates backlog.json for first ticket]
[Agent validates all files]
[Agent shows verification results]
```

---

## 📈 Success Metrics

After setup, measure:

```
✓ .env has valid API key
✓ backlog.json has first ticket
✓ .harness/ files exist and contain project-specific rules
✓ npm run typecheck passes
✓ HARNESS_MODE=deterministic npm run dev completes
✓ npm run logs shows successful ticket processing
```

If all pass → Setup is complete! ✅

---

## 🔄 Next After Setup

Once the wizard finishes:

1. **Customize .harness/** files if needed
   - Review patterns.md, update if needed
   - Add more forbidden zones if discovered
   - Adjust governance policies

2. **Create more tickets**
   - See `../docs/REQUIREMENTS_CAPTURE.md`
   - Follow same format as auto-generated first ticket

3. **Switch to LLM mode** (when confident)
   - Edit .env: `HARNESS_MODE=llm`
   - Verify budget in place
   - Run `npm run dev`

4. **Monitor & iterate**
   - Check costs: `npm run costs`
   - Review logs: `npm run logs`
   - Adjust patterns based on results

---

## 📝 Quick Command Reference

```bash
# Setup
cd harness
bash setup-wizard.sh

# After setup
npm run typecheck        # Validate configuration
npm run dev             # Run harness (deterministic or llm mode)
npm run logs            # View decision trail
npm run costs           # View token usage (if LLM mode)

# Troubleshooting
cat .env                # Check configuration
cat backlog.json        # Check first ticket
ls -la ../.harness/     # Check context files
npm test                # Run harness tests
```

---

## ❓ FAQ

**Q: How long does setup take?**  
A: 45-60 minutes end-to-end with reading + running + verification.

**Q: Do I need to understand all the technical details?**  
A: No. The wizard asks in plain English and generates complex configs automatically.

**Q: Can I change .harness/ files after setup?**  
A: Yes. They're YAML/markdown. Edit anytime to refine patterns or rules.

**Q: What if I have a custom tech stack?**  
A: Select "Other" when prompted. The wizard will ask for specifics.

**Q: Can I use the wizard multiple times?**  
A: Yes. Each run overwrites .env and backlog.json (but backs up .harness/).

**Q: Is this for cloud/enterprise only?**  
A: No. Works for any project size: solo, team, enterprise.

---

## 🎉 Ready?

```bash
cd harness
bash setup-wizard.sh
```

The wizard will guide you through the rest! ✨

---

**Created:** 2026-07-30  
**Version:** 1.0  
**Status:** Production Ready  

