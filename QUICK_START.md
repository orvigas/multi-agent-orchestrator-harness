# Setup Rápido del Harness — Quick Reference

> **⚠️ Documento de visión, no descripción del estado actual.** Este archivo
> describe un despliegue de producción hipotético (Docker, SSH+GitHub real,
> LangSmith, múltiples providers reales). El proyecto en este repo hoy es un
> harness reproducible y 100% local: cada rol "IA" es una heurística
> determinista (nunca llama a un LLM real), no hay Docker (sandboxing =
> copia a `os.tmpdir()`) y `.harness/` vive en este mismo repo. Ver
> `.claude/CLAUDE.md` para el estado real y qué de lo de abajo ya existe.

**Imprime esto o guárdalo como bookmark. Todo aquí está orientado al copy-paste.**

---

## 🚀 Los 5 pasos principales (15 minutos)

### ✅ Paso 1: Herramientas básicas (5 min)

```bash
# Comprueba que tienes todo
node --version           # Debe ser v18+
docker --version         # Debe ser 20+
git --version           # Cualquier versión
ssh -T git@github.com   # Debe decir "successfully authenticated"

# Si falta algo:
brew install node docker  # macOS
choco install nodejs docker  # Windows (con Chocolatey)
apt-get install nodejs docker.io  # Linux
```

### ✅ Paso 2: Obtén API keys (3 min)

Elige UNO (o combina varios):

**Anthropic (Claude):**
- Ve a: https://console.anthropic.com/api-keys
- Copia la key, pégala en `.env`

**OpenAI (GPT):**
- Ve a: https://platform.openai.com/api-keys
- Copia la key, pégala en `.env`

**OpenRouter (múltiples modelos, más barato):**
- Ve a: https://openrouter.io/keys
- Copia la key, pégala en `.env`

### ✅ Paso 3: Clona y configura el harness (5 min)

```bash
# Clona usando SSH (seguro)
git clone git@github.com:tu-org/multiagent-harness.git
cd multiagent-harness

# Crea .env
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-YOUR-KEY
EOF

# O si usas OpenRouter:
cat > .env << 'EOF'
OPENROUTER_API_KEY=sk-or-YOUR-KEY
EOF

# Instala dependencias
npm install
```

### ✅ Paso 4: Configura tu proyecto destino (3 min)

En el repo que quieres automatizar:

```bash
cd tu-proyecto
mkdir -p .harness/{rules,architecture,governance}

# Copia las templates
cp ../multiagent-harness/.harness/rules/forbidden-zones.md .harness/rules/
cp ../multiagent-harness/.harness/architecture/overview.md .harness/architecture/
cp ../multiagent-harness/.harness/governance/approvals.md .harness/governance/

# Edita según tu proyecto
nano .harness/rules/forbidden-zones.md
```

### ✅ Paso 5: Corre tu primer ticket (1 min)

```bash
cd multiagent-harness

# NO hay tracker externo conectado (sin GitHub/Jira reales, ver categoría 3
# del análisis de gaps) — --ticket-id/--title/--description arman un ticket
# ad-hoc local, procesado sobre ESTE MISMO repo (no hay un $TARGET_REPO
# separado todavía).
npm run harness:execute -- --ticket-id PROJ-123 --title "Agregar validación de email en LoginService"

# Mira los logs — deberías ver:
# (bootstrap) Config cargada: N roles, N providers.
# (select_next_ticket) Ticket seleccionado: PROJ-123 ...
# (knowledge_engine) ... items de evidencia ...
# (planning) Discovery/Planning/Validation -> valid ...
# (implementation) N task(s) del plan pasaron Implementation Loop + Validation Pipeline + Quality Gate + Merge Manager de punta a punta.
# Merge Manager promueve el patch al árbol real (o hace dry-run — ver
# config/merge-manager.yml, dryRun:true por defecto), NUNCA "git merge a main"
```

---

## 📊 Configuración de providers (copy-paste)

### Opción A: Solo Anthropic (recomendado si empiezas)

```bash
cat > config/providers.yml << 'EOF'
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY

roles:
  orchestrator:
    provider: anthropic
    model: claude-sonnet-4-5
  planner:
    provider: anthropic
    model: claude-opus-4-8
  implementer:
    provider: anthropic
    model: claude-opus-4-8
  retriever:
    provider: anthropic
    model: claude-haiku-4-5
  kb_verifier:
    provider: anthropic
    model: claude-sonnet-4-5
  plan_validator:
    provider: anthropic
    model: claude-sonnet-4-5
  quality_gate_reviewer:
    provider: anthropic
    model: claude-opus-4-8
  recovery_diagnostician:
    provider: anthropic
    model: claude-sonnet-4-5
  recovery_strategist:
    provider: anthropic
    model: claude-haiku-4-5
EOF
```

### Opción B: Solo OpenRouter (barato)

```bash
cat > config/providers.yml << 'EOF'
providers:
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY

roles:
  orchestrator:
    provider: openrouter
    model: anthropic/claude-opus-4-8
  planner:
    provider: openrouter
    model: anthropic/claude-opus-4-8
  implementer:
    provider: openrouter
    model: anthropic/claude-opus-4-8
  retriever:
    provider: openrouter
    model: meta-llama/llama-3.1-70b
  kb_verifier:
    provider: openrouter
    model: openai/gpt-4-turbo
  plan_validator:
    provider: openrouter
    model: openai/gpt-4-turbo
  quality_gate_reviewer:
    provider: openrouter
    model: anthropic/claude-opus-4-8
  recovery_diagnostician:
    provider: openrouter
    model: openai/gpt-4-turbo
  recovery_strategist:
    provider: openrouter
    model: meta-llama/llama-3.1-70b
EOF
```

---

## 🐛 Troubleshooting rápido

| Error | Solución |
|---|---|
| `API key inválida` | Copia exacto de https://console.anthropic.com (sin espacios) |
| `Cannot find module @langchain/langgraph` | `npm install && npm ci` |
| `docker: command not found` | Instala Docker Desktop, abre la app, reinicia terminal |
| `Permission denied (publickey)` | SSH no está configurada, ve a Parte 1.2 de la guía completa |
| `No such file or directory: .harness/rules/` | Crea la carpeta: `mkdir -p .harness/{rules,architecture,governance}` |

---

## ✨ Comandos útiles (después que funciona)

```bash
# Ver el decision log de cada corrida (lee .harness/runs.jsonl) — real, sin --follow
npm run harness:logs

# Ver coste (SIMULADO — ningún LLM real cobra todavía) de los últimos N días
npm run harness:costs -- --days=1

# Checkpointer persistente: IMPLEMENTADO (SQLite, Phase 1.1, 2026-07-30)
# harness:checkpoints / harness:rollback: comandos CLI aún NO implementados
# (pero la persistencia subyacente de checkpoint sí está disponible)

# Monitoreo en dashboard (opt-in real, cero código — ver .env.example)
open https://smith.langchain.com  # LangSmith

# Alertas en Slack: NO implementado (ver categoría 3 del análisis de gaps —
# contradice el harness local/sin credenciales de servicios externos).
# El equivalente real que SÍ existe: un archivo JSON por escalación en
# .harness/escalations/ (Merge Manager, Capa 8).
```

---

## 📚 Si quieres leer más

- **Guía completa para dummies:** `IMPLEMENTATION_GUIDE.md`
- **Capa 1 (Orchestrator):** `01-orchestrator-langgraph-howto.md`
- **Capa 2 (Knowledge Engine):** `02-knowledge-engine-loop-howto.md`
- **Capa 3 (Planner):** `03-planner-loop-howto.md`
- **Capa 4 (Implementation):** `04-implementation-loop-howto.md`
- **Capa 5 (Validation):** `05-validation-pipeline-howto.md`
- **Capa 6 (Recovery):** `06-recovery-loop-howto.md`
- **Capa 7 (Quality Gate):** `07-quality-gate-howto.md`
- **Capa 8 (Merge Manager):** `08-merge-manager-howto.md`

---

## 💡 Tips de pro

1. **Empieza con Anthropic** — mejor calidad, debugging más fácil
2. **Usa OpenRouter después** — 50% más barato cuando entiendas qué haces
3. **Monitorea coste** — `npm run harness:costs` diariamente al principio
4. **Lee los logs de LangSmith** — ahí ves EXACTAMENTE qué hace el harness
5. **Crea .harness/ en git** — trata las reglas como código (versionable, reviewable)
6. **Empieza con 1-2 tickets/día** — no lances 20 a la vez
7. **Ajusta presupuestos después de 10 tickets** — tienes datos reales

---

## 🎯 Checklist de "funciona"

- [ ] `node --version` → v18+
- [ ] `docker --version` → 20+
- [ ] `ssh -T git@github.com` → authenticated
- [ ] `.env` con API key válida
- [ ] `config/providers.yml` creado
- [ ] `tu-proyecto/.harness/` con files
- [ ] `npm run harness:execute` no explota
- [ ] Ves logs del harness
- [ ] Un ticket se completó automáticamente ✨

Si todo tiene ✅, **estás listo para ir en serio.**

---

**Tiempo real hasta primer ticket:** 15-30 minutos
**Tiempo por ticket:** 2-5 minutos (automático)
**Ahorro:** 2-3 horas por ticket
**ROI:** Pays for itself después de 10-20 tickets

🚀 **Bienvenido al futuro.**
