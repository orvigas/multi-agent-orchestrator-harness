# Setup Rápido del Harness — Quick Reference

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

# Crea un ticket simple en GitHub/Jira
# (Ej: "Agregar validación de email en LoginService")

# Ejecuta el harness
npm run harness:execute -- --ticket-id PROJ-123

# Mira los logs — debería ver:
# [Orchestrator] Iniciando PROJ-123
# [Knowledge Engine] Buscando LoginService...
# [Planner] Generando plan...
# [Implementation] Generando código...
# [Validation] Compilando... Tests... ✅
# [Merge Manager] Mergeando a main...
# [Orchestrator] PROJ-123 COMPLETADO
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
# Ver logs en vivo
npm run harness:logs --follow

# Ver coste gastado hoy
npm run harness:costs --days=1

# Ver estado de checkpoints
npm run harness:checkpoints

# Time-travel: volver a un paso anterior
npm run harness:rollback --ticket-id PROJ-123 --step=4

# Monitoreo en dashboard
open https://smith.langchain.com  # LangSmith

# Alertas en Slack
npm run harness:config -- --slack-webhook https://hooks.slack.com/...
```

---

## 📚 Si quieres leer más

- **Guía completa para dummies:** `00-implementation-guide-for-dummies.md`
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
