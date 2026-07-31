#!/bin/bash

################################################################################
# Multi-Agent Harness Setup Wizard - Automated Script
################################################################################
#
# Usage: ./setup-wizard.sh
#
# This script guides you through configuring the harness for a new project
# It generates:
#   - harness/.env
#   - harness/config/providers.yml (customized)
#   - .harness/rules/forbidden-zones.md
#   - .harness/architecture/patterns.md
#   - .harness/governance/policy.md
#   - harness/backlog.json (first ticket)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_question() {
    echo -e "${YELLOW}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Create temp file for storing answers
ANSWERS_FILE="/tmp/harness_setup_answers.sh"
> "$ANSWERS_FILE"

################################################################################
# PHASE 1: Project Discovery
################################################################################

print_header "PHASE 1: PROJECT DISCOVERY"

# Q1.1: Project Name
print_question "Q1.1: What is your project called?"
print_info "Example: 'MyApp - An e-commerce platform'"
read -p "> " PROJECT_NAME
echo "PROJECT_NAME='$PROJECT_NAME'" >> "$ANSWERS_FILE"

# Q1.2: Primary Language
print_question "\nQ1.2: What is the primary language of your codebase?"
PS3="Select (1-7): "
select LANG in "TypeScript/JavaScript" "Python" "Java" "Go" "Rust" "C#/.NET" "Other"; do
    case $LANG in
        "TypeScript/JavaScript")
            PRIMARY_LANG="typescript"
            ;;
        "Python")
            PRIMARY_LANG="python"
            ;;
        "Java")
            PRIMARY_LANG="java"
            ;;
        "Go")
            PRIMARY_LANG="go"
            ;;
        "Rust")
            PRIMARY_LANG="rust"
            ;;
        "C#/.NET")
            PRIMARY_LANG="csharp"
            ;;
        "Other")
            read -p "Specify: " PRIMARY_LANG
            ;;
    esac
    break
done
echo "PRIMARY_LANG='$PRIMARY_LANG'" >> "$ANSWERS_FILE"
print_success "Language: $PRIMARY_LANG"

# Q1.3: Framework (conditional)
print_question "\nQ1.3: What is your primary web framework?"

case $PRIMARY_LANG in
    "typescript")
        PS3="Select (1-5): "
        select FW in "Express.js" "NestJS" "Next.js" "Fastify" "Other"; do
            FRAMEWORK=$(echo $FW | tr '[:upper:]' '[:lower:]')
            [ "$FW" = "Other" ] && read -p "Specify: " FRAMEWORK
            break
        done
        ;;
    "python")
        PS3="Select (1-4): "
        select FW in "Django" "FastAPI" "Flask" "Other"; do
            FRAMEWORK=$(echo $FW | tr '[:upper:]' '[:lower:]')
            [ "$FW" = "Other" ] && read -p "Specify: " FRAMEWORK
            break
        done
        ;;
    "java")
        PS3="Select (1-3): "
        select FW in "Spring Boot" "Quarkus" "Other"; do
            FRAMEWORK=$(echo $FW | tr '[:upper:]' '[:lower:]')
            [ "$FW" = "Other" ] && read -p "Specify: " FRAMEWORK
            break
        done
        ;;
    "go")
        PS3="Select (1-4): "
        select FW in "Gin" "Echo" "Chi" "Other"; do
            FRAMEWORK=$(echo $FW | tr '[:upper:]' '[:lower:]')
            [ "$FW" = "Other" ] && read -p "Specify: " FRAMEWORK
            break
        done
        ;;
    *)
        read -p "Framework: " FRAMEWORK
        ;;
esac
echo "FRAMEWORK='$FRAMEWORK'" >> "$ANSWERS_FILE"
print_success "Framework: $FRAMEWORK"

# Q1.4: Project Structure
print_question "\nQ1.4: Show first 3 levels of your project structure"
print_info "Example:"
print_info "  my-app/"
print_info "  ├── src/controllers, services, models, utils"
print_info "  ├── tests/"
print_info "  ├── config/"
print_info "  └── package.json"
read -p "> " PROJECT_STRUCTURE
echo "PROJECT_STRUCTURE='$PROJECT_STRUCTURE'" >> "$ANSWERS_FILE"

# Q1.5: Testing & Quality
print_question "\nQ1.5: Testing & Code Quality (select all that apply)"
print_info "a) Unit tests (framework?)"
print_info "b) Integration tests"
print_info "c) E2E tests"
print_info "d) Linting"
print_info "e) Type checking"
print_info "f) Code coverage"
print_info "g) CI/CD"
read -p "Select (comma-separated: a,b,c...): " QA_CHECKS
echo "QA_CHECKS='$QA_CHECKS'" >> "$ANSWERS_FILE"

read -p "Current code coverage (% or unknown): " COVERAGE
echo "COVERAGE='$COVERAGE'" >> "$ANSWERS_FILE"
print_success "QA Stack noted"

# Q1.6: Architecture
print_question "\nQ1.6: Architectural patterns or constraints (2-3 points)"
print_info "Examples: Monolithic MVC, Domain-driven design, Event-driven, Microservices"
read -p "> " ARCHITECTURE_NOTES
echo "ARCHITECTURE_NOTES='$ARCHITECTURE_NOTES'" >> "$ANSWERS_FILE"

# Q1.7: Forbidden Zones
print_question "\nQ1.7: What CANNOT be modified? (comma-separated paths)"
print_info "Examples: migrations/, .github/workflows/, terraform/, legacy/"
read -p "> " FORBIDDEN_ZONES
echo "FORBIDDEN_ZONES='$FORBIDDEN_ZONES'" >> "$ANSWERS_FILE"

# Q1.8: Code Conventions
print_question "\nQ1.8: Code naming conventions"
case $PRIMARY_LANG in
    "typescript")
        print_info "Class naming: PascalCase (default)"
        print_info "Function naming: camelCase (default)"
        read -p "Other conventions (or press Enter): " CODE_CONVENTIONS
        ;;
    "python")
        print_info "Function naming: snake_case (default)"
        read -p "Other conventions (or press Enter): " CODE_CONVENTIONS
        ;;
    *)
        read -p "Describe conventions: " CODE_CONVENTIONS
        ;;
esac
echo "CODE_CONVENTIONS='$CODE_CONVENTIONS'" >> "$ANSWERS_FILE"

# Q1.9: Team & Deployment
print_question "\nQ1.9: Team size and deployment frequency"
PS3="Team size: "
select TEAM_SIZE in "Solo" "2-5" "5-15" "15+"; do
    break
done
echo "TEAM_SIZE='$TEAM_SIZE'" >> "$ANSWERS_FILE"

PS3="Deployment frequency: "
select DEPLOY_FREQ in "Manual" "Daily" "Multiple times daily" "Automated on merge"; do
    break
done
echo "DEPLOY_FREQ='$DEPLOY_FREQ'" >> "$ANSWERS_FILE"

read -p "CI/CD tool (GitHub Actions, GitLab CI, Jenkins, etc.): " CI_CD_TOOL
echo "CI_CD_TOOL='$CI_CD_TOOL'" >> "$ANSWERS_FILE"

################################################################################
# PHASE 2: API Key & Environment
################################################################################

print_header "PHASE 2: API KEY & ENVIRONMENT"

# Q2.1: LLM Provider
print_question "Q2.1: Which LLM provider?"
PS3="Select (1-3): "
select PROVIDER in "Anthropic Claude (recommended)" "OpenAI GPT-4" "OpenRouter"; do
    case $PROVIDER in
        "Anthropic Claude"*)
            PRIMARY_PROVIDER="anthropic"
            API_KEY_NAME="ANTHROPIC_API_KEY"
            API_URL="https://console.anthropic.com/account/keys"
            ;;
        "OpenAI"*)
            PRIMARY_PROVIDER="openai"
            API_KEY_NAME="OPENAI_API_KEY"
            API_URL="https://platform.openai.com/account/api-keys"
            ;;
        "OpenRouter"*)
            PRIMARY_PROVIDER="openrouter"
            API_KEY_NAME="OPENROUTER_API_KEY"
            API_URL="https://openrouter.ai/keys"
            ;;
    esac
    break
done
echo "PRIMARY_PROVIDER='$PRIMARY_PROVIDER'" >> "$ANSWERS_FILE"
print_success "Provider: $PRIMARY_PROVIDER"

# Q2.2: API Key
print_question "\nQ2.2: API Key"
print_info "Get your key at: $API_URL"
read -s -p "Paste API key (hidden): " API_KEY
echo ""
echo "API_KEY='$API_KEY'" >> "$ANSWERS_FILE"
print_success "API key saved (will not be shown)"

# Q2.3: Budget
print_question "\nQ2.3: LLM Budget"
read -p "Monthly budget (USD, suggested 100-500): \$" MONTHLY_BUDGET
echo "MONTHLY_BUDGET='$MONTHLY_BUDGET'" >> "$ANSWERS_FILE"

read -p "Hard limit (USD): \$" HARD_LIMIT
echo "HARD_LIMIT='$HARD_LIMIT'" >> "$ANSWERS_FILE"

print_success "Budget configured: \$$MONTHLY_BUDGET/month, hard limit \$$HARD_LIMIT"

################################################################################
# PHASE 3: Knowledge Engine
################################################################################

print_header "PHASE 3: KNOWLEDGE ENGINE"

print_question "Q3.1: Codebase size"
PS3="File count: "
select CODEBASE_SIZE in "< 100" "100-500" "500-2000" "2000+"; do
    break
done
echo "CODEBASE_SIZE='$CODEBASE_SIZE'" >> "$ANSWERS_FILE"

PS3="Lines of code: "
select LOC in "< 10K" "10K-50K" "50K-200K" "200K+"; do
    break
done
echo "LOC='$LOC'" >> "$ANSWERS_FILE"
print_success "Codebase size: $CODEBASE_SIZE files, $LOC LOC"

# Q3.2: Key locations
print_question "\nQ3.2: Key file locations (one per line, or leave blank):"
print_info "Examples: src/models/, src/services/, src/controllers/"
KEY_LOCATIONS=""
while true; do
    read -p "> " line
    [ -z "$line" ] && break
    KEY_LOCATIONS="$KEY_LOCATIONS$line"$'\n'
done
echo "KEY_LOCATIONS='$KEY_LOCATIONS'" >> "$ANSWERS_FILE"

################################################################################
# PHASE 4: Governance
################################################################################

print_header "PHASE 4: GOVERNANCE & RULES"
print_info "Generating .harness/ files based on your answers..."

# Create .harness directories if they don't exist
mkdir -p ../.harness/{rules,architecture,governance}

# Generate forbidden-zones.md
cat > ../.harness/rules/forbidden-zones.md << 'EOF'
# Forbidden Zones - Harness Modification Restrictions

## Absolute Forbidden Zones

### Security & Secrets
- `secrets/`
- `.env*`
- `**/*.pem`
- `**/*.key`
- Password/credential files

### Infrastructure & DevOps
- `.github/workflows/` (CI/CD pipelines)
- `terraform/` (Infrastructure as Code)
- `docker/` (Container definitions)
- `k8s/` (Kubernetes manifests)

### Project-Specific Restrictions
EOF

if [ ! -z "$FORBIDDEN_ZONES" ]; then
    echo "" >> ../.harness/rules/forbidden-zones.md
    echo "## Custom Restrictions" >> ../.harness/rules/forbidden-zones.md
    echo "$FORBIDDEN_ZONES" | tr ',' '\n' | while read zone; do
        echo "- \`${zone// /}\`" >> ../.harness/rules/forbidden-zones.md
    done
fi

cat >> ../.harness/rules/forbidden-zones.md << 'EOF'

## Why This Matters

The harness **NEVER** modifies files in forbidden zones.
If a ticket requires modification → automatic escalation to human review.
No exceptions.
EOF

print_success "Generated: .harness/rules/forbidden-zones.md"

# Generate patterns.md
cat > ../.harness/architecture/patterns.md << EOF
# Architecture & Patterns

## Project: $PROJECT_NAME

### Technology Stack
- **Language:** $PRIMARY_LANG
- **Framework:** $FRAMEWORK
- **Team Size:** $TEAM_SIZE
- **Deployment:** $DEPLOY_FREQ

### Architecture
$ARCHITECTURE_NOTES

### Code Conventions
$CODE_CONVENTIONS

### Codebase Structure
\`\`\`
$PROJECT_STRUCTURE
\`\`\`

### Key Locations
$KEY_LOCATIONS

### Quality Gates
- Testing: $QA_CHECKS
- Coverage Target: $COVERAGE%

## Patterns the Harness Will Follow

When generating code:
1. Match the language conventions
2. Organize code like existing modules
3. Follow testing patterns
4. Respect architecture decisions
5. Use framework idioms

## Design Decisions

Key decisions documented to guide code generation:
1. $ARCHITECTURE_NOTES
2. Team size: $TEAM_SIZE (affects PR size, complexity)
3. Deploy frequency: $DEPLOY_FREQ (affects risk tolerance)
EOF

print_success "Generated: .harness/architecture/patterns.md"

# Generate policy.md
cat > ../.harness/governance/policy.md << EOF
# Governance & Recovery Policy

## Project: $PROJECT_NAME

### Hard Rules (Never Violated)

1. **Forbidden Zones:** Never modify $FORBIDDEN_ZONES
2. **Security:** If security audit finds HIGH severity → Always escalate
3. **Build:** Must pass compilation ($PRIMARY_LANG build tools)
4. **Tests:** Existing tests must continue passing
5. **Budget:** Never exceed \$$HARD_LIMIT/month

### Escalation Triggers

Manual human review required for:
- ✓ Forbidden zone violation
- ✓ Security issue found
- ✓ Merge conflict
- ✓ Build failure (after 2 retry attempts)
- ✓ Test failure (root cause diagnosis required)
- ✓ Architecture violation
- ✓ Coverage drop > 5%

### Recovery Strategy

Maximum iterations: 3 attempts per ticket
If repeated failure → Force strategy change

### Cost Controls

- Monthly budget: \$$MONTHLY_BUDGET
- Hard limit: \$$HARD_LIMIT
- Downgrade strategy: Try cheaper model when > 80% budget
- Alert when: > 95% budget used
EOF

print_success "Generated: .harness/governance/policy.md"

################################################################################
# PHASE 5: First Ticket
################################################################################

print_header "PHASE 5: CREATE FIRST TICKET"

print_question "Q5.1: What kind of first task?"
PS3="Select (1-4): "
select TICKET_TYPE in "Bug Fix" "Feature Addition" "Refactoring" "Documentation"; do
    TICKET_TYPE=$(echo $TICKET_TYPE | tr '[:upper:]' '[:lower:]')
    break
done
echo "TICKET_TYPE='$TICKET_TYPE'" >> "$ANSWERS_FILE"

read -p "Ticket ID (e.g., BUG-1, FEAT-1): " TICKET_ID
echo "TICKET_ID='$TICKET_ID'" >> "$ANSWERS_FILE"

read -p "Ticket title (one line): " TICKET_TITLE
echo "TICKET_TITLE='$TICKET_TITLE'" >> "$ANSWERS_FILE"

read -p "Description (2-3 lines): " TICKET_DESC
echo "TICKET_DESC='$TICKET_DESC'" >> "$ANSWERS_FILE"

read -p "Target repo path (absolute): " TARGET_REPO_PATH
echo "TARGET_REPO_PATH='$TARGET_REPO_PATH'" >> "$ANSWERS_FILE"

read -p "Requirements (detailed, or press Ctrl+D when done):" REQUIREMENTS << 'EOT'
Please add detailed requirements here:
1. First step
2. Second step
3. Constraints
EOT
echo "REQUIREMENTS='$REQUIREMENTS'" >> "$ANSWERS_FILE"

################################################################################
# PHASE 6: Generate .env
################################################################################

print_header "PHASE 6: GENERATING CONFIGURATION"

# Create .env
cat > .env << EOF
# Multi-Agent Harness Configuration
# Generated: $(date)

# ============================================
# LLM Configuration
# ============================================
PRIMARY_PROVIDER=$PRIMARY_PROVIDER
${API_KEY_NAME}=$API_KEY

# Mode: deterministic (no LLM) or llm (real Claude)
HARNESS_MODE=deterministic

# ============================================
# Database
# ============================================
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db

# ============================================
# Budget & Cost Control
# ============================================
MONTHLY_BUDGET=$MONTHLY_BUDGET
HARD_LIMIT=$HARD_LIMIT
DOWNGRADE_STRATEGY=true

# ============================================
# Observability (optional)
# ============================================
# LANGCHAIN_TRACING_V2=false
# LANGCHAIN_API_KEY=

# ============================================
# Environment
# ============================================
NODE_ENV=development
EOF

print_success "Generated: harness/.env"

# Create backlog.json
cat > backlog.json << EOF
{
  "tickets": [
    {
      "ticketId": "$TICKET_ID",
      "title": "$TICKET_TITLE",
      "description": "$TICKET_DESC",
      "targetRepoPath": "$TARGET_REPO_PATH",
      "priority": "normal",
      "requirements": "$REQUIREMENTS"
    }
  ],
  "metadata": {
    "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "projectName": "$PROJECT_NAME",
    "language": "$PRIMARY_LANG",
    "framework": "$FRAMEWORK"
  }
}
EOF

print_success "Generated: harness/backlog.json"

################################################################################
# PHASE 7: Verification
################################################################################

print_header "PHASE 7: VERIFICATION"

print_info "Checking setup..."

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install Node.js"
    exit 1
fi
print_success "npm found: $(npm --version)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    npm install --silent
fi
print_success "Dependencies verified"

# Check .env
if [ -f ".env" ]; then
    print_success ".env file created"
else
    print_error ".env file not found"
    exit 1
fi

# Check backlog.json
if [ -f "backlog.json" ]; then
    print_success "backlog.json created"
else
    print_error "backlog.json not found"
    exit 1
fi

# Check .harness files
if [ -f "../.harness/rules/forbidden-zones.md" ]; then
    print_success ".harness/rules/ created"
else
    print_error ".harness/rules/ not found"
fi

################################################################################
# PHASE 8: First Test Run
################################################################################

print_header "PHASE 8: FIRST TEST RUN (Deterministic Mode)"

print_info "Your harness is configured!"
print_info "Running first test in DETERMINISTIC mode (no LLM calls, no costs)..."
print_info ""

read -p "Ready to run? (y/n): " READY
if [ "$READY" != "y" ]; then
    print_info "Setup complete! Run 'npm run dev' manually when ready."
    exit 0
fi

echo ""
print_info "Starting orchestrator..."
npm run dev

################################################################################
# PHASE 9: Summary
################################################################################

print_header "✅ SETUP COMPLETE!"

echo -e "${GREEN}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                  HARNESS SETUP SUCCESSFUL                       ║
╚══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "\n${YELLOW}Generated Files:${NC}"
echo "  ✓ harness/.env (configuration)"
echo "  ✓ harness/backlog.json (first ticket)"
echo "  ✓ .harness/rules/forbidden-zones.md"
echo "  ✓ .harness/architecture/patterns.md"
echo "  ✓ .harness/governance/policy.md"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "  1. Review .harness/ files to ensure they match your project"
echo "  2. Edit backlog.json to customize your first ticket"
echo "  3. Switch to LLM mode when ready:"
echo "       Edit .env: HARNESS_MODE=llm"
echo "  4. Run harness:"
echo "       npm run dev"
echo "  5. Monitor progress:"
echo "       npm run logs   # See decisions"
echo "       npm run costs  # See LLM costs"

echo -e "\n${YELLOW}Documentation:${NC}"
echo "  • SETUP_WIZARD.md - Full configuration guide"
echo "  • ../docs/REQUIREMENTS_CAPTURE.md - How to create tickets"
echo "  • ../docs/GETTING_STARTED.md - Setup details"

echo -e "\n${GREEN}Happy coding! 🚀${NC}\n"

# Cleanup temp file
rm -f "$ANSWERS_FILE"
