# 🧙 Harness Setup — From Zero to Running

**Complete guide to set up and configure the harness from scratch.**

---

## ⚡ 30-Second Start

```bash
# 1. Clone or extract the repo
git clone <repo-url> multiai
cd multiai/harness

# 2. Install dependencies
npm install

# 3. Run interactive wizard
bash setup-wizard.sh

# 4. Execute
npm run dev
```

---

## 📥 Full Setup (5 minutes)

### Option A: Interactive Wizard (Recommended)

```bash
cd harness
bash setup-wizard.sh
```

The wizard will:
1. Ask ~20 questions about your project
2. Generate `.env`, `backlog.json`, `.harness/` files
3. Validate configuration
4. Run optional first test

**Time:** 45-60 minutes (includes reading + answering)

### Option B: Manual Setup

```bash
cd harness

# 1. Install dependencies
npm install

# 2. Create configuration
cp .env.example .env
# Edit .env with your API keys

# 3. Create first ticket
cp backlog.json.example backlog.json
# Edit backlog.json with your ticket

# 4. Create context files
mkdir -p ../.harness/{rules,architecture,governance}

# 5. Add forbidden zones
cat > ../.harness/rules/forbidden-zones.md << 'EOF'
# Forbidden Zones
- secrets/
- .env*
- **/*.pem
- **/*.key
EOF

# 6. Add architecture patterns
cat > ../.harness/architecture/patterns.md << 'EOF'
# Architecture
## Project Structure
- Language: TypeScript
- Framework: Express
## Patterns
[Your patterns here]
EOF

# 7. Add governance policy
cat > ../.harness/governance/policy.md << 'EOF'
# Governance
## Hard Rules
1. Forbidden zones (see above)
2. Security: npm audit HIGH+ escalate
3. Tests must pass
4. Budget: never exceed $500/month
EOF

# 8. Test it
npm run dev
```

---

## 🧙 Wizard Details (9 Phases)

### Phase 1: Project Discovery
- Project name (e.g., "MyAPI - REST API for bookings")
- Primary language (TypeScript, Python, Java, Go, Rust, C#)
- Framework (Express, NestJS, FastAPI, Spring Boot, etc.)
- Code structure (monorepo, polyrepo, standard)
- Team size

### Phase 2: Testing & Quality
- Unit tests: framework? (Jest, Pytest, JUnit)
- Integration tests? (yes/no)
- E2E tests? (yes/no)
- Linting? (yes/no, which tool)
- Type checking? (yes/no)
- Code coverage? (yes/no, target)

### Phase 3: Architecture & Patterns
- Key modules/services
- Design patterns (MVC, service-layer, etc.)
- Database (SQL, NoSQL, none)
- Authentication (JWT, OAuth, etc.)
- API style (REST, GraphQL, gRPC)

### Phase 4: Forbidden Zones
- Files/dirs never to touch (configs, secrets, migrations)
- CI/CD pipeline files
- Auth-related code (if custom)
- Database migrations

### Phase 5: Evidence Retrieval
- Key code locations (controllers, models, services)
- Config files
- Test locations
- Documentation (wiki, docs folder)

### Phase 6: LLM Setup
- Provider (Anthropic, OpenAI, OpenRouter)
- API key (or placeholder for testing)
- Budget ($-$$$)
- Models per role (Opus, Sonnet, GPT-4, etc.)

### Phase 7: Create First Ticket
- Ticket type (feature, bug, refactor, tech-debt)
- Ticket title & description
- Create example ticket for first run

### Phase 8: Verification Checklist
- Confirm all files created
- Validate configuration syntax
- Check API key works (optional)

### Phase 9: First Test (Optional)
- Run harness in deterministic mode
- Show sample execution output
- Provide next steps

---

## 🔌 Configuration Files

### `.env` (Harness Configuration)
```bash
# LLM Provider
PRIMARY_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-v0-...
HARNESS_MODE=deterministic  # or 'llm'

# Database
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db

# Budget
MONTHLY_BUDGET=500
HARD_LIMIT=600
DOWNGRADE_STRATEGY=true

# Environment
NODE_ENV=development
```

### `backlog.json` (First Ticket)
```json
{
  "tickets": [
    {
      "ticketId": "TASK-1",
      "title": "Your first ticket",
      "description": "Brief description",
      "targetRepoPath": "/path/to/repo",
      "priority": "normal",
      "requirements": "What needs to be done"
    }
  ],
  "metadata": {
    "createdAt": "2026-07-30T10:00:00Z",
    "projectName": "Your Project"
  }
}
```

### `.harness/rules/forbidden-zones.md`
```markdown
# Forbidden Zones — Never Modify

## Absolute Forbidden
- secrets/ — No credentials
- .env* — Configuration files
- **/*.pem — Private keys
- **/*.key — SSH keys
- database/migrations/ — Schema changes
- .github/workflows/ — CI/CD
- src/auth/ — Authentication (if flagged)
```

### `.harness/architecture/patterns.md`
```markdown
# Architecture & Patterns

## Project: YourProject
- Language: TypeScript
- Framework: Express
- Database: PostgreSQL
- Team: 3-5 people

## Patterns
- Controllers in `src/controllers/`
- Services in `src/services/`
- Models in `src/models/`
- Tests: `*.test.ts` (Jest)

## When Generating Code
1. Match language conventions
2. Follow existing patterns
3. Use the framework idioms
4. Match code style
```

### `.harness/governance/policy.md`
```markdown
# Governance & Recovery

## Hard Rules
1. Forbidden Zones: Always enforce
2. Security: npm audit HIGH+ always escalate to human
3. Build: Must compile (tsc clean)
4. Tests: Must pass
5. Budget: Never exceed $600/month

## Escalation Triggers
- Security findings → Immediate escalation
- Budget exceeded → Stop and escalate
- Compilation fails → Log error + escalate
- Tests fail → Investigate + escalate

## Recovery Strategy
- Max 3 recovery attempts per ticket
- If repeats 2+, escalate to human
- Document why each attempt failed
```

---

## 🚀 Running the Harness

### Deterministic Mode (Testing, No Cost)
```bash
cd harness
npm run dev
```

**Features:**
- No API calls
- Reproducible
- Fast
- Useful for testing

### LLM Mode (Production)
```bash
cd harness
HARNESS_MODE=llm npm run dev
```

**Features:**
- Uses Claude (or configured LLM)
- Intelligent analysis
- Better code generation
- Costs ~$0.50-$5 per ticket

---

## 📊 Monitoring

### View Logs
```bash
npm run logs
```

Shows:
- Which layer ran (Knowledge Engine, Planner, etc.)
- What it discovered/planned/implemented
- Results and errors

### View Costs (LLM mode)
```bash
npm run costs
```

Shows:
- Cost per ticket
- Cost per layer
- Total monthly spend
- Budget remaining

---

## ✅ Verification

After setup, verify:

```bash
# 1. .env exists and has API key
grep ANTHROPIC_API_KEY harness/.env

# 2. backlog.json is valid
cat harness/backlog.json | jq .

# 3. .harness/ created
ls -la ../.harness/

# 4. TypeScript compiles
npm run typecheck

# 5. First test (deterministic mode)
npm run dev
```

All should pass ✅

---

## 🆘 Troubleshooting

### "command not found: npm"
→ Install Node.js from https://nodejs.org/ (v18+)

### "ANTHROPIC_API_KEY is required"
→ Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-v0-...`

### "bash: setup-wizard.sh: Permission denied"
→ Make executable: `chmod +x setup-wizard.sh`

### ".harness directory not found"
→ Create it: `mkdir -p .harness/{rules,architecture,governance}`

### "backlog.json has wrong format"
→ Copy from `.example`: `cp backlog.json.example backlog.json`

### "Connection timeout to Claude API"
→ Check: Internet connectivity, API key valid, rate limits

---

## 📚 What Wizard Generates

After running `bash setup-wizard.sh`, you'll have:

```
harness/
├── .env                    ← LLM config
├── backlog.json            ← First ticket
├── package.json            ← Updated
└── config/
    └── providers.yml       ← Model config

.harness/
├── rules/
│   └── forbidden-zones.md  ← Restricted files
├── architecture/
│   ├── patterns.md         ← Code patterns
│   └── key-files.md        ← Priority files
└── governance/
    └── policy.md           ← Safety rules
```

All files are auto-generated based on your answers.

---

## 🎯 Next Steps

1. **Create more tickets:**
   See `PRODUCT_OWNER.md` for interactive ticket creation

2. **Configure more:**
   Edit `.harness/` files to refine patterns and rules

3. **Switch to LLM:**
   Edit `.env`: `HARNESS_MODE=llm`
   Then: `npm run dev`

4. **Monitor execution:**
   - `npm run logs` — See decisions
   - `npm run costs` — See spending
   - `npm run test` — Run tests

---

## 📖 Recommended Reading Order

1. **This file** (you are here) — Setup
2. **PRODUCT_OWNER.md** — Create & manage tickets
3. **README.md** — Architecture overview
4. **`.claude/CLAUDE.md`** — Deep technical details

---

## 🎉 Ready?

```bash
cd harness
bash setup-wizard.sh
```

The wizard will guide you through everything! 🚀

---

**Version:** 1.0  
**Status:** ✅ Production Ready  
**Last Updated:** 2026-07-30
