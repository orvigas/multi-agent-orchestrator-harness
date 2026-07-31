# 🧙 Multi-Agent Harness — Setup & Usage Guide

Harness multi-agente independiente construido con LangGraph.js (TypeScript).  
**Completamente autónomo** — puede ser removido sin afectar el proyecto host.

---

## ⚡ Quick Start (5 minutos)

### Opción 1: Usar Setup Wizard (Recomendado)

```bash
# 1. Ir al directorio harness
cd harness

# 2. Ejecutar wizard interactivo
bash setup-wizard.sh

# 3. Responde ~20 preguntas
# 4. El wizard genera todo automáticamente
# 5. Listo!
```

**Resultado:** Proyecto 100% configurado en 45-60 minutos.

### Opción 2: Setup Manual

```bash
# 1. Instalar dependencias
cd harness
npm install

# 2. Crear configuración
cp .env.example .env
# Editar .env con tus API keys

# 3. Crear primer ticket
cp backlog.json.example backlog.json
# Editar backlog.json con tu ticket

# 4. Ejecutar
npm run dev
```

---

## 📥 Instalación Completa (Desde Cero)

### Paso 1: Clonar o Descargar el Repositorio

**Opción A: Clonar desde Git**
```bash
git clone <repo-url> my-harness-setup
cd my-harness-setup
```

**Opción B: Descargar ZIP**
```bash
# Descargar ZIP desde GitHub
# Extraer en tu directorio
cd harness-setup
```

### Paso 2: Navegar al Directorio Harness

```bash
cd harness
pwd  # Verificar que estás en .../harness
```

### Paso 3: Instalar Node.js (Si no lo tienes)

**Verificar si tienes Node.js:**
```bash
node --version  # Debe ser v18+
npm --version   # Debe ser 9+
```

**Si no lo tienes:**
- Descargar desde https://nodejs.org/
- Instalar versión LTS (18 o superior)

### Paso 4: Instalar Dependencias del Harness

```bash
npm install
# Esperar a que termine (2-3 minutos)
# Debería crear node_modules/
```

### Paso 5: Configurar el Harness

Ahora elige uno de estos caminos:

---

## 🧙 Opción A: Usar Setup Wizard (Automático)

**El wizard te guía interactivamente.**

```bash
bash setup-wizard.sh
```

**El wizard hará:**

1. ✅ Hacer preguntas sobre tu proyecto (20 preguntas)
   - Nombre, lenguaje, framework
   - Estructura, testing, patrones
   - Zonas protegidas, restricciones

2. ✅ Generar archivos automáticamente
   - `harness/.env` (configuración LLM)
   - `harness/backlog.json` (primer ticket)
   - `.harness/rules/forbidden-zones.md` (zonas protegidas)
   - `.harness/architecture/patterns.md` (patrones)
   - `.harness/governance/policy.md` (políticas)

3. ✅ Validar toda la configuración

4. ✅ Ejecutar primer test (opcional)

**Resultado:** Proyecto completamente listo en 60 minutos.

---

## 📋 Opción B: Setup Manual

Si prefieres hacer todo manualmente:

### Paso 1: Copiar Template .env

```bash
cp .env.example .env
```

### Paso 2: Configurar .env

Edita `harness/.env`:

```bash
# ============================================
# LLM Configuration
# ============================================
PRIMARY_PROVIDER=anthropic              # o openai, openrouter
ANTHROPIC_API_KEY=sk-ant-v0-...        # Tu API key
HARNESS_MODE=deterministic             # o llm (después)

# ============================================
# Database
# ============================================
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db

# ============================================
# Budget & Cost Control
# ============================================
MONTHLY_BUDGET=300                      # Tu presupuesto USD
HARD_LIMIT=400                          # Máximo absoluto
DOWNGRADE_STRATEGY=true                 # Usar modelos más baratos si presupuesto alto

# ============================================
# Environment
# ============================================
NODE_ENV=development
```

**Obtener API Key:**
- Anthropic: https://console.anthropic.com/account/keys
- OpenAI: https://platform.openai.com/account/api-keys
- OpenRouter: https://openrouter.ai/keys

### Paso 3: Crear Primer Ticket

Edita `harness/backlog.json`:

```json
{
  "tickets": [
    {
      "ticketId": "TASK-1",
      "title": "Tu primer ticket",
      "description": "Descripción breve",
      "targetRepoPath": "/ruta/a/tu/repo",
      "priority": "normal",
      "requirements": "Detalle de lo que hay que hacer"
    }
  ],
  "metadata": {
    "createdAt": "2026-07-30T10:00:00Z",
    "projectName": "Tu Proyecto"
  }
}
```

### Paso 4: Crear Contexto (.harness/)

En la **raíz del proyecto** (no en harness/), crea `.harness/`:

```bash
mkdir -p .harness/{rules,architecture,governance}
```

**Crear `.harness/rules/forbidden-zones.md`:**

```markdown
# Forbidden Zones

## Absolute Forbidden
- secrets/
- .env*
- **/*.pem
- **/*.key
- database/migrations/
- .github/workflows/

[Agregar más según tu proyecto]
```

**Crear `.harness/architecture/patterns.md`:**

```markdown
# Architecture & Patterns

## Project: Tu Proyecto
- Language: TypeScript / Python / Java
- Framework: Express / Django / Spring Boot
- Team: X personas

## Patterns
[Describe tus patrones de código]
```

**Crear `.harness/governance/policy.md`:**

```markdown
# Governance & Recovery Policy

## Hard Rules
1. Forbidden Zones: [lista]
2. Security: npm audit HIGH+ → Escalate
3. Build: Must compile
4. Tests: Must pass
5. Budget: Never exceed $[limit]

## Escalation Triggers
[Cuándo escalar a humanos]

## Recovery Strategy
- Max 3 iterations per ticket
```

---

## 🚀 Ejecutar el Harness

### Modo Determinístico (Sin Costo, Para Testing)

```bash
cd harness
HARNESS_MODE=deterministic npm run dev
```

**Ventajas:**
- ❌ No usa Claude (no cuesta)
- ✅ Reproducible
- ✅ Rápido
- ✅ Perfecto para primeras pruebas

### Modo LLM (Con Claude, Producción)

```bash
cd harness
HARNESS_MODE=llm npm run dev
```

**Requisitos:**
- ✅ ANTHROPIC_API_KEY válida en .env
- ✅ Presupuesto disponible
- ✅ Ticket listo en backlog.json

**Costo:** $0.50-$5 por ticket (depende complejidad)

---

## 📊 Monitorear Ejecución

### Ver Logs de Decisiones

```bash
npm run logs
```

Output ejemplo:
```
TASK-1: Successfully processed
  - Knowledge Engine: Found 5 files
  - Planner: Created 3-task plan
  - Implementation: Generated 70 lines
  - Validation: All tests passed
  - Quality Gate: Coverage +1.2%
```

### Ver Costos (Modo LLM)

```bash
npm run costs
```

Output ejemplo:
```
TASK-1:
  Discovery: $0.08
  Planning: $0.15
  Implementation: $0.25
  Total: $0.48
```

---

## 📚 Documentación del Wizard

### SETUP_WIZARD.md
- Guía completa de todas las fases
- Para referencia y entendimiento profundo

### SETUP_WIZARD_TEST.md
- Ejemplo real completo (NestJS e-commerce)
- Ver qué esperar de cada pregunta

### SETUP_WIZARD_README.md
- Quick start del wizard
- Troubleshooting y FAQ

### WIZARD_REQUIRED_FILES.md
- Guía completa de cada archivo obligatorio
- Ejemplos por tech stack
- Cómo llenarlos correctamente

---

## 🔧 Comandos Útiles

```bash
# Desde harness/

# Ejecutar
npm run dev              # Run full orchestrator
npm run execute          # Alias

# Testing
npm run typecheck        # Verificar TypeScript
npm test                 # Correr tests

# Demos por capa
npm run kb:demo          # Knowledge Engine
npm run planner:demo     # Planner
npm run implementation:demo
npm run validation:demo
npm run recovery:demo

# Monitoreo
npm run logs             # Ver decisiones
npm run costs            # Ver costos (si LLM mode)
```

---

## 📁 Estructura

```
harness/
├── src/
│   ├── orchestrator/        # Capa 0: Orquestador
│   ├── workflows/           # Capas 1-6: Motores
│   ├── services/            # Servicios (LLM, tokens, etc.)
│   ├── config/              # Loaders YAML
│   └── index.ts             # Entry point
│
├── config/                  # YAML config
│   ├── providers.yml
│   ├── orchestrator.yml
│   └── *.yml
│
├── .env.example             # Template de config
├── package.json             # Dependencias
├── tsconfig.json            # TypeScript
│
├── SETUP_WIZARD.md          # Guía wizard (referencia)
├── SETUP_WIZARD_TEST.md     # Ejemplo real
├── SETUP_WIZARD_README.md   # Quick start wizard
└── WIZARD_REQUIRED_FILES.md # Archivos obligatorios

.harness/                   # Contexto compartido
├── rules/
│   └── forbidden-zones.md
├── architecture/
│   └── patterns.md
└── governance/
    └── policy.md
```

---

## ✅ Verificar Setup

Después de configurar, verifica:

```bash
# 1. .env existe y tiene API key
grep ANTHROPIC_API_KEY harness/.env

# 2. backlog.json válido
cat harness/backlog.json | jq .

# 3. .harness/ creado
ls -la .harness/

# 4. TypeScript compila
npm run typecheck

# 5. Primer test (opcional)
HARNESS_MODE=deterministic npm run dev
```

Todo debería pasar sin errores ✅

---

## 🆘 Troubleshooting

### "command not found: npm"
→ Instala Node.js desde https://nodejs.org/

### "ANTHROPIC_API_KEY is required"
→ Agregalo a .env, incluso valores dummy funcionan en deterministic mode

### "bash: setup-wizard.sh: Permission denied"
→ Hacer ejecutable: `chmod +x setup-wizard.sh`

### ".harness directory not found"
→ Crear en la raíz: `mkdir -p .harness/{rules,architecture,governance}`

### "backlog.json has wrong format"
→ Ver ejemplo en WIZARD_REQUIRED_FILES.md

---

## 📖 Leer Primero

1. **SETUP_WIZARD_README.md** — Cómo usar wizard (5 min)
2. **WIZARD_REQUIRED_FILES.md** — Qué archivos necesitas (20 min)
3. **SETUP_WIZARD_TEST.md** — Ejemplo real (15 min)
4. **Ejecutar**: `bash setup-wizard.sh` (45 min)

**Total: ~90 minutos para setup + entendimiento**

---

## 🎉 Listo!

Una vez configurado:

```bash
# Crear más tickets en backlog.json
# Ejecutar harness
npm run dev

# Ver resultados
npm run logs
```

---

## 🔗 Enlaces Rápidos

- **Setup Wizard:** `bash setup-wizard.sh`
- **Required Files Guide:** `WIZARD_REQUIRED_FILES.md`
- **Full Reference:** `SETUP_WIZARD.md`
- **Real Example:** `SETUP_WIZARD_TEST.md`
- **Parent Docs:** `../DOCUMENTATION_INDEX.md`

---

**Status:** ✅ Production Ready  
**Version:** 1.0  
**Last Updated:** 2026-07-30
