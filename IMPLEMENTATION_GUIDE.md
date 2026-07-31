# Cómo Implementar el Harness Multiagente en tu Proyecto — Guía para Dummies

> **⚠️ Documento de visión, no descripción del estado actual.** Ver la nota
> equivalente en `QUICK_START.md` / `.claude/CLAUDE.md` para el detalle
> completo de qué existe hoy vs. qué es aspiracional acá (Docker, SSH+git
> real, PostgreSQL, LangSmith, Sentry, webhooks, `TARGET_REPO` separado, los
> 10 roles con LLMs reales, etc.).

**Para:** Desarrolladores que quieren automatizar la implementación de tickets con IA, pero no tienen contexto de este proyecto.

**Duración estimada:** 3-4 horas de setup inicial + 30 min de configuración por proyecto destino.

---

## Parte 0: ¿Qué va a pasar? (La película de 10 segundos)

Imagina que escribes un ticket:
```
"Agregar validación de email en LoginService y actualizar los tests"
```

Sin el harness: esperas a que alguien lo lea, lo implemente, lo revise, lo mergee. Horas o días.

Con el harness: en menos de 5 minutos:
1. IA busca dónde vive `LoginService` y sus tests actuales (Knowledge Engine)
2. IA hace un plan: "primero actualizar el servicio, luego los tests, en ese orden" (Planner)
3. IA escribe el código siguiendo exactamente ese plan (Implementation Loop)
4. Herramientas reales comprueban: ¿compila? ¿pasan los tests? ¿está limpio? (Validation Pipeline)
5. Si algo falla, IA lo intenta arreglar de forma inteligente (Recovery Loop)
6. Un revisor final (no IA) valida que la arquitectura del cambio tiene sentido (Quality Gate)
7. Si todo está OK, se mergea automáticamente (Merge Manager)

**Resultado:** código real, funcionando, mergeado en `main`. Sin que hayas escrito una línea.

---

## Parte 1: Preparar tu máquina (30 min)

### 1.1 Instala Node.js 18+

```bash
# Comprueba que tienes Node.js 18 o superior
node --version  # debe decir v18.x.x o superior
npm --version   # debe decir 9.x.x o superior
```

Si no lo tienes:
- **macOS:** `brew install node`
- **Windows:** Descarga de https://nodejs.org (elige "LTS")
- **Linux:** `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`

### 1.2 Configura SSH para GitHub (crítico para seguridad)

El harness va a hacer push automático a tu repo. **NUNCA** uses contraseñas o API keys en git commands — usa SSH, que es más seguro.

#### 1.2.1 Genera tu clave SSH

```bash
# Genera una clave SSH nueva si no tienes una
ssh-keygen -t ed25519 -C "tu-email@ejemplo.com"

# Presiona Enter 3 veces (sin contraseña, el harness necesita acceso automático)
# Tu clave se guardó en ~/.ssh/id_ed25519
```

#### 1.2.2 Añade tu clave SSH a GitHub

```bash
# Copia tu clave pública
cat ~/.ssh/id_ed25519.pub

# Luego:
# 1. Ve a https://github.com/settings/ssh/new
# 2. Pega el contenido de id_ed25519.pub
# 3. Llámala "Harness Bot" o similar
# 4. Haz click en "Add SSH key"
```

#### 1.2.3 Comprueba que funciona

```bash
ssh -T git@github.com
# Debería decir: "Hi tu-usuario! You've successfully authenticated, but GitHub does not provide shell access."
```

#### 1.2.4 Clona repos usando SSH (no HTTPS)

```bash
# ❌ INCORRECTO (HTTPS, requiere contraseña cada vez)
# git clone https://github.com/tu-org/mi-proyecto.git

# ✅ CORRECTO (SSH, automático)
git clone git@github.com:tu-org/mi-proyecto.git

# Para repos existentes, cambia la URL:
cd mi-proyecto
git remote set-url origin git@github.com:tu-org/mi-proyecto.git
git remote -v  # Verifica que dice git@github.com
```

### 1.3 Instala Docker (CRÍTICO — no opcional)

**¿Por qué Docker?** El harness va a hacer cambios de código en tu repo. Para evitar que rompa accidentalmente tu máquina, todo ocurre dentro de contenedores Docker aislados — como si fuera en una máquina virtual descartable.

Sin Docker:
- ❌ El harness toca archivos reales de tu computadora
- ❌ Si algo falla, puede dañar tu código
- ❌ No puedes rollback fácilmente
- ❌ Problemas de permisos y dependencias

Con Docker:
- ✅ El harness corre en un "mini-Linux" aislado
- ✅ Si falla, descartas el contenedor y listo
- ✅ Ambiente reproducible (funciona igual en tu máquina que en CI)
- ✅ Sin contaminar tu sistema

**Instalación:**

```bash
# macOS:
brew install docker
# Abre Docker Desktop desde Applications

# Windows:
# 1. Descarga Docker Desktop: https://www.docker.com/products/docker-desktop
# 2. Instala y reinicia
# 3. En PowerShell: docker --version

# Linux (Ubuntu/Debian):
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker $USER  # Permite docker sin sudo
# Reinicia la terminal
```

**Comprueba que funciona:**

```bash
docker --version
docker run hello-world
# Debería descargar y mostrar: "Hello from Docker!"
```

### 1.4 Instala las herramientas que el harness va a usar

```bash
# Git (para merge, tags, etc.)
git --version

# Herramientas de tu stack específico:
# Si usas Node/npm:
npm install -g typescript

# Si usas Python (alternativa a Node, aunque la guía asume Node):
python3 --version

# Si usas Java:
java -version
mvn --version
```

### 1.5 Clona o crea el repo del harness

```bash
# Opción A: Si ya existe el repositorio del harness (usa SSH)
git clone git@github.com:tu-org/multiagent-harness.git
cd multiagent-harness

# Opción B: Si es la primera vez, crea la estructura desde cero
mkdir multiagent-harness
cd multiagent-harness
git init
git remote add origin git@github.com:tu-org/multiagent-harness.git
npm init -y
```

---

## Parte 2: Setup base del harness (30 min)

### 2.1 Instala las dependencias

```bash
npm install @langchain/langgraph @langchain/core @langchain/anthropic @langchain/openai zod dotenv js-yaml
```

Si no sabes qué es cada una:
- `@langchain/*`: librerías que hacen funcionar los agentes IA
- `zod`: valida que la configuración sea correcta
- `dotenv`: carga variables de entorno (API keys) sin ponerlas en el código
- `js-yaml`: lee archivos de config `.yml` (más legible que JSON)

### 2.2 Crea la estructura de directorios

```bash
mkdir -p src/{orchestrator,workflows,knowledge-engine,config,tools}
mkdir -p .harness/{rules,architecture,governance}
mkdir -p config
touch src/orchestrator/state.ts src/orchestrator/graph.ts
touch .env
```

Ahora tu repo se ve así:

```
multiagent-harness/
├── src/
│   ├── orchestrator/
│   ├── workflows/
│   ├── knowledge-engine/
│   ├── config/
│   └── tools/
├── .harness/                  # ← Aquí viven las reglas del harness
│   ├── rules/
│   ├── architecture/
│   └── governance/
├── config/                     # ← Configuración por proyecto destino
├── .env                        # ← Variables secretas (NUNCA commitearlo)
└── package.json
```

### 2.3 Crea el archivo `.env` con tus credenciales

```bash
# .env (IMPORTANTE: añade esto a .gitignore)
# Elige UNO o MÁS proveedores según lo que tengas disponible:

# Opción A: Solo Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...    # Obtén esto de https://console.anthropic.com

# Opción B: Solo OpenAI (GPT)
OPENAI_API_KEY=sk-...           # Obtén esto de https://platform.openai.com/api-keys

# Opción C: Solo OpenRouter (acceso a múltiples modelos)
OPENROUTER_API_KEY=sk-or-...    # Obtén esto de https://openrouter.io/keys

# Opcional: Base de datos para checkpoints (pruebas rápidas pueden usar MemorySaver)
CHECKPOINT_DB_URL=postgresql://user:pass@localhost/checkpoints
```

> **⚠️ SEGURIDAD:** Nunca commitees el `.env`. Añade a `.gitignore`:
> ```bash
> echo ".env" >> .gitignore
> echo ".env.local" >> .gitignore
> git rm --cached .env  # Si ya lo commiteaste por error
> ```

#### Cómo obtener cada API key:

| Proveedor | Paso 1 | Paso 2 | Coste |
|---|---|---|---|
| **Anthropic (Claude)** | Ve a https://console.anthropic.com | Crea una key en "API Keys" | $0.80 / 1M tokens entrada, $2.40 salida (Claude 3.5 Sonnet) |
| **OpenAI (GPT)** | Ve a https://platform.openai.com/api-keys | Crea una key en "API Keys" | $0.50 / 1M tokens entrada, $1.50 salida (GPT-4o) |
| **OpenRouter** | Ve a https://openrouter.io/keys | Crea una key en "API Keys" | Variable (10-20 proveedores), promedia 50% menos que directo |

### 2.4 Crea tu primer archivo de config

Aquí hay 3 ejemplos: solo Anthropic, solo OpenRouter, y hybrid (múltiples).

#### **Opción A: Solo Anthropic (Claude) — Recomendado si empiezas**

```yaml
# config/providers.yml
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
    baseUrl: https://api.anthropic.com

roles:
  orchestrator:
    provider: anthropic
    model: claude-opus-4-8          # Mejor capacidad (para orquestación)
    maxTokens: 4096
  discovery:
    provider: anthropic
    model: claude-sonnet-4-5        # Balance
  planner:
    provider: anthropic
    model: claude-opus-4-8          # Tareas complejas
  implementer:
    provider: anthropic
    model: claude-opus-4-8          # Generación de código
  retriever:
    provider: anthropic
    model: claude-haiku-4-5         # Búsquedas rápidas/baratas
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
    model: claude-haiku-4-5         # Decisión acotada
```

#### **Opción B: Solo OpenRouter — Acceso a múltiples modelos**

```yaml
# config/providers.yml
providers:
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY
    baseUrl: https://openrouter.ai/api/v1

roles:
  orchestrator:
    provider: openrouter
    model: anthropic/claude-opus-4-8     # Claude vía OpenRouter
    maxTokens: 4096
  discovery:
    provider: openrouter
    model: meta-llama/llama-3.1-405b     # Llama es más barato
  planner:
    provider: openrouter
    model: openai/gpt-4-turbo            # GPT para razonamiento
  implementer:
    provider: openrouter
    model: anthropic/claude-opus-4-8     # Claude para código
  retriever:
    provider: openrouter
    model: meta-llama/llama-3.1-70b      # Llama rápido/barato
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
```

#### **Opción C: Hybrid (múltiples proveedores) — Optimizar coste + capacidad**

```yaml
# config/providers.yml
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
    baseUrl: https://api.anthropic.com
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: https://api.openai.com/v1
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY
    baseUrl: https://openrouter.ai/api/v1

roles:
  # Tareas de alta capacidad: usa el mejor (Claude Opus)
  orchestrator:
    provider: anthropic
    model: claude-opus-4-8
    maxTokens: 4096
  planner:
    provider: anthropic
    model: claude-opus-4-8
  implementer:
    provider: anthropic
    model: claude-opus-4-8

  # Tareas de capacidad media: usa lo económico (Sonnet o equivalente)
  discovery:
    provider: anthropic
    model: claude-sonnet-4-5
  quality_gate_reviewer:
    provider: anthropic
    model: claude-sonnet-4-5

  # Tareas de decisión rápida: usa lo MÁS barato
  retriever:
    provider: openrouter              # OpenRouter es 40% más barato
    model: meta-llama/llama-3.1-70b
  recovery_strategist:
    provider: openrouter
    model: meta-llama/llama-3.1-70b
  
  # Verificadores: proveedor distinto (evita sesgos compartidos)
  kb_verifier:
    provider: openai
    model: gpt-4-turbo
  plan_validator:
    provider: openai
    model: gpt-4-turbo
  recovery_diagnostician:
    provider: openai
    model: gpt-4-turbo
```

#### **Guía de qué modelo usar en cada rol:**

| Rol | Complejidad | Proveedor recomendado | Modelo | Por qué |
|---|---|---|---|---|
| **Orchestrator** | ⭐⭐⭐⭐⭐ Alta | Anthropic | claude-opus-4-8 | Orquestación compleja, decisiones críticas |
| **Planner** | ⭐⭐⭐⭐ Alta | Anthropic | claude-opus-4-8 | Razonamiento multi-paso, dependencias |
| **Implementer** | ⭐⭐⭐⭐ Alta | Anthropic | claude-opus-4-8 | Generación de código de calidad |
| **Quality Gate Reviewer** | ⭐⭐⭐ Media | Anthropic | claude-sonnet-4-5 | Revisiones arquitectónicas |
| **Discovery** | ⭐⭐⭐ Media | Anthropic o OpenAI | claude-sonnet-4-5 / gpt-4-turbo | Análisis de requisitos |
| **KB Verifier** | ⭐⭐⭐ Media | OpenAI (diferente) | gpt-4-turbo | Verificación independiente, otro proveedor |
| **Plan Validator** | ⭐⭐⭐ Media | OpenAI (diferente) | gpt-4-turbo | Verificación independiente |
| **Recovery Diagnostician** | ⭐⭐⭐ Media | OpenAI (diferente) | gpt-4-turbo | Diagnóstico independiente |
| **Retriever** | ⭐⭐ Baja | OpenRouter | llama-3.1-70b | Búsquedas rápidas, coste mínimo |
| **Recovery Strategist** | ⭐⭐ Baja | OpenRouter | llama-3.1-70b | Decisión simple, coste mínimo |

---

#### **Comparativa de coste por 1M tokens:**

| Proveedor | Modelo | Entrada | Salida | Recomendación |
|---|---|---|---|---|
| **Anthropic** | Claude Opus 4.8 | $3 | $15 | Mejor capacidad, precio medio |
| **Anthropic** | Claude Sonnet 4.5 | $3 | $15 | Balance velocidad/coste |
| **Anthropic** | Claude Haiku 4.5 | $0.80 | $4 | Más barato de Anthropic |
| **OpenAI** | GPT-4 Turbo | $10 | $30 | Caro, muy capaz |
| **OpenAI** | GPT-4o | $5 | $15 | Mejor relación en OpenAI |
| **OpenRouter (Llama)** | Llama 3.1 405b | $3.5 | $10.5 | Muy capaz, barato |
| **OpenRouter (Llama)** | Llama 3.1 70b | $0.35 | $1.40 | Más barato del mercado |

---

#### **Estrategia de ahorro recomendada:**

Si tu presupuesto es **$10/día**:
```yaml
# Usa Anthropic para tasks críticas, OpenRouter para el resto
roles:
  orchestrator:
    provider: anthropic
    model: claude-sonnet-4-5      # No necesita Opus
  planner:
    provider: anthropic
    model: claude-sonnet-4-5      # Suficiente para planes
  implementer:
    provider: openrouter
    model: meta-llama/llama-3.1-405b  # Excelente código, 70% más barato
  retriever:
    provider: openrouter
    model: meta-llama/llama-3.1-70b   # Rápido y baratísimo
  # Resto: usa lo que queda de presupuesto
```

Esto te cuesta ~$3-5/día vs $20+ solo con Anthropic.

---

## Parte 3: Configurar para tu primer proyecto (45 min)

Antes de que el harness pueda trabajar en tu repo, necesita entender:
- Dónde vive el código
- Qué reglas arquitectónicas tiene
- Qué herramientas correr (compile, tests, lint, etc.)

### 3.1 Crea la carpeta `.harness/` en tu proyecto destino

En el **repo del proyecto que quieres automatizar** (no en el repo del harness), crea:

```bash
cd mi-proyecto-java      # O Node, Python, lo que sea
mkdir -p .harness/{rules,architecture,governance}
```

### 3.2 Define tus reglas de arquitectura

```markdown
# .harness/rules/forbidden-zones.md
# Zonas prohibidas del repo

El harness NUNCA debe tocar:
- `src/main/resources/secrets/` — contiene credenciales
- `legacy/` — código congelado, solo lectura
- `vendor/` o `node_modules/` — dependencias, no código propio

Si una tarea requiere tocar estas rutas, se escala a humano automáticamente.
```

```markdown
# .harness/rules/coding-style.md
# Estilo de código

- Máximo 120 caracteres por línea
- Nombres de variable: camelCase (no snake_case)
- Clases públicas: PascalCase
- Comenta métodos públicos (JavaDoc o JSDoc)
```

```markdown
# .harness/rules/testing.md
# Reglas de tests

- Todo cambio en `src/` debe tener test en `test/`
- Mínimo 80% de cobertura en código nuevo
- Nombres de test: describe(descripción, () => { it(...) })
```

### 3.3 Define tu arquitectura

```markdown
# .harness/architecture/overview.md
# Arquitectura del proyecto

## Stack
- Backend: Node.js + Express
- Frontend: React
- Base de datos: PostgreSQL
- Cache: Redis

## Estructura de directorios
- `src/controllers/` — endpoints HTTP
- `src/services/` — lógica de negocio
- `src/models/` — esquemas de base de datos
- `src/middleware/` — autenticación, logging, etc.

## Patrón arquitectónico: Hexagonal (Ports & Adapters)
- `src/domain/` — entidades y casos de uso (core del negocio)
- `src/ports/` — interfaces (contratos)
- `src/adapters/` — implementaciones (base de datos, APIs externas)
```

```markdown
# .harness/architecture/adr/0001-use-hexagonal.md
# ADR: Usar arquitectura hexagonal

**Decisión:** Todos los cambios deben respetar las fronteras hexagonales.

**Razón:** Aislamiento de dependencias externas, testabilidad, mantenibilidad.

**Implicaciones:**
- Nunca importes directo desde `adapters/` en `domain/`
- `controllers/` son adapters, no logic
- La base de datos NO debe filtrarse al `domain/`
```

### 3.4 Define gobernanza (quién decide qué)

```markdown
# .harness/governance/approvals.md
# Control de cambios

## Allow (sin confirmación humana)
- Cambios en `src/services/` con tests que pasan
- Actualización de dependencias menores (patch version)
- Fixes de documentación y comentarios

## Ask (requiere humano)
- Cambios en `src/domain/` o `src/middleware/`
- Migraciones de base de datos
- Cambios en env variables o configuración

## Deny (nunca automático)
- Cambios en `src/config/secrets*`
- Modificación de `.github/workflows/`
- Cambios en permisos o roles
```

```markdown
# .harness/governance/budgets.md
# Presupuesto de tokens y dinero

- Presupuesto diario: 1M tokens (2-3 dólares en Claude)
- Máximo 5 iteraciones por ticket
- Si agota presupuesto: escalar el ticket restante a humano
```

### 3.5 Configura qué herramientas correr

```yaml
# config/validation-pipeline.yml
validation:
  compileCommand: "npm run build"           # o "mvn compile" si es Java
  testCommand: "npm test -- --findRelatedTests {files}"
  lintCommand: "npm run lint -- {files}"
  staticAnalysisCommand: "npm run lint:types"   # TypeScript type-check
  securityCommand: "npm audit --audit-level moderate"
  performance:
    enabled: false                          # Se activa solo en cambios críticos
    command: "npm run bench"
  timeouts:
    compileMs: 120000       # 2 minutos
    testsMs: 300000         # 5 minutos
    lintMs: 60000           # 1 minuto
```

Si usas otro stack:
- **Java/Maven:** `compileCommand: "mvn clean compile"`
- **Python:** `compileCommand: "python -m py_compile src/*.py"`
- **Go:** `compileCommand: "go build ./..."`

---

## Parte 3.5: Quick Start por Provider (copiar-pegar directo)

Si no quieres leer tablas, elige tu proveedor y copia esto:

### Quick Start: Anthropic (Claude)

```bash
# 1. Obtén tu API key de https://console.anthropic.com/api-keys
# 2. Crea .env
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE
EOF

# 3. Copia este config/providers.yml
cat > config/providers.yml << 'EOF'
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY

roles:
  orchestrator:
    provider: anthropic
    model: claude-sonnet-4-5
    maxTokens: 4096
  discovery:
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

# Listo, pasa a Parte 4
```

### Quick Start: OpenRouter (barato, múltiples modelos)

```bash
# 1. Obtén tu API key de https://openrouter.io/keys
# 2. Crea .env
cat > .env << 'EOF'
OPENROUTER_API_KEY=sk-or-YOUR-KEY-HERE
EOF

# 3. Copia este config/providers.yml (mezcla Llama + Claude + GPT)
cat > config/providers.yml << 'EOF'
providers:
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY

roles:
  # Tareas caras: usa Claude (solo por ahora)
  orchestrator:
    provider: openrouter
    model: anthropic/claude-opus-4-8
    maxTokens: 4096
  planner:
    provider: openrouter
    model: anthropic/claude-opus-4-8
  implementer:
    provider: openrouter
    model: anthropic/claude-opus-4-8
  
  # Tareas medianas: usa Llama 405b (excelente precio/capacidad)
  discovery:
    provider: openrouter
    model: meta-llama/llama-3.1-405b
  quality_gate_reviewer:
    provider: openrouter
    model: meta-llama/llama-3.1-405b
  
  # Tareas simples: usa Llama 70b (súper barato)
  retriever:
    provider: openrouter
    model: meta-llama/llama-3.1-70b
  recovery_strategist:
    provider: openrouter
    model: meta-llama/llama-3.1-70b
  kb_verifier:
    provider: openrouter
    model: meta-llama/llama-3.1-405b
  plan_validator:
    provider: openrouter
    model: meta-llama/llama-3.1-405b
  recovery_diagnostician:
    provider: openrouter
    model: meta-llama/llama-3.1-405b
EOF

# Listo, pasa a Parte 4
```

### Quick Start: OpenAI (GPT-4)

```bash
# 1. Obtén tu API key de https://platform.openai.com/api-keys
# 2. Crea .env
cat > .env << 'EOF'
OPENAI_API_KEY=sk-YOUR-KEY-HERE
EOF

# 3. Copia este config/providers.yml
cat > config/providers.yml << 'EOF'
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

roles:
  orchestrator:
    provider: openai
    model: gpt-4-turbo
    maxTokens: 4096
  discovery:
    provider: openai
    model: gpt-4-turbo
  planner:
    provider: openai
    model: gpt-4-turbo
  implementer:
    provider: openai
    model: gpt-4-turbo
  retriever:
    provider: openai
    model: gpt-4o  # Más barato para búsquedas
  kb_verifier:
    provider: openai
    model: gpt-4-turbo
  plan_validator:
    provider: openai
    model: gpt-4-turbo
  quality_gate_reviewer:
    provider: openai
    model: gpt-4-turbo
  recovery_diagnostician:
    provider: openai
    model: gpt-4-turbo
  recovery_strategist:
    provider: openai
    model: gpt-4o
EOF

# Listo, pasa a Parte 4
```

---

## Parte 4: Ejecutar tu primer ticket (30 min)

### 4.1 Escribe un ticket simple

En tu sistema de tracking (GitHub Issues, Jira, Linear, etc.):

```
Título: Agregar validación de email en RegisterService
Descripción:
El servicio RegisterService debe validar que el email sea válido antes
de registrar un usuario. Si el email es inválido, lanzar BadRequestError.

Acceptance criteria:
- Email con formato inválido rechaza con código 400
- Email válido procesa normalmente
- Existe test que valida ambos casos
```

### 4.2 Inicia el harness con ese ticket

```bash
cd multiagent-harness

# TARGET_REPO separado del harness: IMPLEMENTADO (Phase 1, 2026-07-30)
# Opción A: Procesar el ticket contra TU repo (recomendado para producción)
npx tsx src/index.ts --target /path/to/tu-repo \
  --ticket-id "PROJ-123" \
  --title "Agregar validación de email en RegisterService"

# Opción B: Procesar contra el harness mismo (para testing/demos)
npx tsx src/index.ts \
  --ticket-id "PROJ-123" \
  --title "Agregar validación de email en RegisterService"
```

Ahora el harness va a:
1. **Leer el ticket** (PROJ-123)
2. **Buscar** dónde vive `RegisterService` en tu código
3. **Hacer un plan** (actualizar servicio → escribir tests)
4. **Implementar** (generar código)
5. **Validar** (compilar, tests, lint)
6. **Reportar** hallazgos de arquitectura/seguridad
7. **Mergear** si todo está OK

### 4.3 Monitorea el progreso

Durante la ejecución, verás logs como:

```
[Orchestrator] Ticket PROJ-123 iniciado
[Knowledge Engine] Buscando RegisterService...
  → Encontrado: src/services/RegisterService.ts
  → Tests relacionados: test/services/RegisterService.test.ts
  → Reglas: .harness/rules/coding-style.md, testing.md
[Planner] Plan generado:
  Task 1: Agregar método validateEmail() a RegisterService
  Task 2: Actualizar test suite en RegisterService.test.ts
[Implementation] Generando patches...
  → Patch 1: RegisterService.ts (+15 líneas)
  → Patch 2: RegisterService.test.ts (+30 líneas)
[Validation Pipeline]
  Compile: ✅ PASS
  Tests: ✅ PASS (3/3)
  Lint: ✅ PASS
  Security: ✅ PASS
  Architecture: ✅ PASS (respeta hexagonal)
  Documentation: ⚠️ ADVISORY (añade comentarios JSDoc)
[Quality Gate] Veredicto: CLEAR + ADVISORY
[Merge Manager] Mergeando a main...
  Merge commit: abc123def456
  Tag creado: ticket-PROJ-123
[Orchestrator] Ticket PROJ-123 CERRADO
```

---

## Parte 5: Troubleshooting (¿qué hacer si algo falla?)

### Problema: "API key inválida"

```
Error: 401 Unauthorized - Invalid API key
```

**Solución según proveedor:**

**Anthropic:**
1. Verifica que `ANTHROPIC_API_KEY` en `.env` es correcta
2. Cópialo exacto de https://console.anthropic.com (sin espacios extra)
3. Recarga la sesión: `source .env`
4. Verifica que tiene crédito: https://console.anthropic.com/account/billing/overview

**OpenAI:**
1. Verifica que `OPENAI_API_KEY` en `.env` es correcta
2. Cópialo exacto de https://platform.openai.com/api-keys
3. Verifica que la key tiene permiso de "API key access" habilitado
4. Verifica que tiene crédito o tarjeta válida: https://platform.openai.com/account/billing/overview

**OpenRouter:**
1. Verifica que `OPENROUTER_API_KEY` en `.env` es correcta
2. Cópialo exacto de https://openrouter.io/keys
3. Verifica que tiene crédito: https://openrouter.io/account/top-up
4. Nota: OpenRouter requiere un mínimo de $5 en la cuenta para funcionar

### Problema: "Model not found" o "Model doesn't exist"

```
Error: The model 'meta-llama/llama-3.1-405b' does not exist
```

**Solución:**
1. Verifica que usaste el nombre exacto del modelo
2. Para OpenRouter, ve a https://openrouter.io/models y copia el nombre exacto
3. Los nombres en OpenRouter incluyen el proveedor: `anthropic/claude-opus-4-8`, no solo `claude-opus-4-8`
4. Si el modelo está discontinuado, usa uno similar:
   - `meta-llama/llama-3.1-405b` → `meta-llama/llama-3.1-70b` (más barato, casi igual de capaz)
   - `openai/gpt-4-turbo` → `openai/gpt-4o` (mejor ratio precio/rendimiento)

### Problema: "Rate limit exceeded"

```
Error: 429 Too Many Requests - Rate limit exceeded
```

**Solución:**
1. **Anthropic:** espera 60 segundos, intenta de nuevo
2. **OpenAI:** reduce la concurrencia (el harness intenta 3 roles simultáneamente)
3. **OpenRouter:** aumenta el delay entre requests o sube a un plan pago
4. En `config/orchestrator.yml`, reduce `maxTicketsPerDay`:
   ```yaml
   orchestrator:
     maxTicketsPerDay: 5  # Antes era 20
   ```

### Problema: "Cannot find module @langchain/langgraph"

```
Error: Cannot find module '@langchain/langgraph'
```

**Solución:**
```bash
npm install @langchain/langgraph --save
npm install  # Reinicia todo
```

### Problema: "El harness no encuentra mi código"

El Knowledge Engine no encontró los archivos que buscaba.

**Solución:**
1. Verifica que `TARGET_REPO` apunta al directorio correcto:
   ```bash
   ls $TARGET_REPO/src/services/  # Debería ver tus archivos
   ```
2. Verifica que `.harness/rules/forbidden-zones.md` no está bloqueando la ruta
3. Ejecuta una búsqueda manual:
   ```bash
   grep -r "RegisterService" $TARGET_REPO/src/
   ```

### Problema: "Tests fallan después del merge"

Los tests locales pasaban en el sandbox, pero falla en CI.

**Solución:**
1. Mira los logs del Quality Gate en el reporte final
2. Probablemente fue un issue de `advisory` que el harness no corrigió porque no lo podía
3. Corre el test localmente:
   ```bash
   cd $TARGET_REPO
   npm test
   ```
4. Si falla, es un error real — crea un issue nuevo para que el harness lo intente otra vez

---

## Parte 6: Configuración avanzada (opcional)

### 6.1 Conectar con tu sistema de tracking (Jira/GitHub)

```yaml
# config/orchestrator.yml
orchestrator:
  ticketTracker:
    type: "github"              # o "jira", "linear"
    endpoint: "https://api.github.com/repos/tu-org/mi-proyecto"
    token: "${GITHUB_TOKEN}"
    assignTicketsTo: "harness-bot"
```

### 6.2 Habilitar presupuesto acotado

```yaml
# config/orchestrator.yml
orchestrator:
  budgets:
    tokenLimitPerDay: 1000000       # 1M tokens = ~$2-3
    costLimitPerDay: 5.0            # $5 por día máximo
    maxTicketsPerDay: 20
```

### 6.3 Fallback automático entre providers (si uno falla)

```yaml
# config/providers.yml
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY
  openai:
    apiKeyEnv: OPENAI_API_KEY

roles:
  # Si Anthropic falla, intenta OpenRouter, luego OpenAI
  implementer:
    provider: anthropic
    model: claude-opus-4-8
    fallback:
      - provider: openrouter
        model: meta-llama/llama-3.1-405b
      - provider: openai
        model: gpt-4-turbo
```

Con esto, si la API de Anthropic está caída, el harness automáticamente intenta con OpenRouter.

### 6.4 Cambiar de provider dinámicamente por ticket

```yaml
# config/orchestrator.yml
ticketTypeRules:
  "type: refactor":
    # Refactors complejos: usa el mejor modelo
    implementer:
      provider: anthropic
      model: claude-opus-4-8
  "type: bugfix":
    # Bugfixes simples: usa lo barato
    implementer:
      provider: openrouter
      model: meta-llama/llama-3.1-70b
  "type: documentation":
    # Docs: usa lo más económico
    implementer:
      provider: openrouter
      model: meta-llama/llama-3.1-70b
```

### 6.5 Conectar observabilidad (ver qué hace el harness)

```bash
npm install @langchain/langgraph-checkpoint-postgres
```

```ts
// src/config/database.ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

export const checkpointer = PostgresSaver.fromConnString(
  process.env.CHECKPOINT_DB_URL || "postgresql://localhost/harness"
);
```

Con esto, puedes hacer time-travel en el grafo — retroceder a cualquier punto de ejecución anterior.

### 6.6 Monitorear coste real por ticket

```bash
# Instala un script que analiza logs
npm install --save-dev analyze-harness-costs

# Después de ejecutar tickets:
npx analyze-harness-costs --days=7
```

Output típico:
```
Total cost (last 7 days): $28.43
- Anthropic: $15.20 (53%)
- OpenRouter: $8.90 (31%)
- OpenAI: $4.33 (16%)

Most expensive roles:
1. implementer: $12.50
2. quality_gate_reviewer: $8.20
3. planner: $7.73
```

Con esto ves dónde se va el dinero y puedes ajustar providers.

---

## Parte 6.5: ¿Cuál provider elegir? (Árbol de decisión)

**Si no sabes qué elegir, sigue este árbol:**

```
¿Tienes tarjeta de crédito y quieres calidad máxima?
  ↓ SÍ → Usa ANTHROPIC (Claude)
  ↓ NO → ¿Quieres experimentar?
           ↓ SÍ → Usa OPENROUTER (prueba varios modelos)
           ↓ NO → ¿Tienes presupuesto muy limitado?
                   ↓ SÍ → Usa OPENROUTER + Llama 70b
                   ↓ NO → Usa OPENAI (GPT-4o)
```

**En español simple:**

- **Si eres empresa:** Claude (Anthropic) — lo mejor, confían en ti
- **Si experimentas:** OpenRouter — cambia modelos sin código nuevo
- **Si ahorras dinero:** OpenRouter + Llama — 90% más barato, 80% de capacidad
- **Si necesitas mayores límites:** OpenAI — más capacidad para procesamiento

---

## Parte 6.7: Setup Completo — Qué más necesitas para producción

Lo que configuraste hasta ahora funciona (MVP), pero para que el harness sea **robusto, auditable y seguro en producción**, necesitas estos componentes opcionales:

### 6.7.1 Base de datos para checkpoints (PostgreSQL)

**¿Por qué?** El harness necesita recordar qué hizo en cada ticket, para poder hacer "time-travel" si algo falla.

**Sin DB (desarrollo):**
```yaml
checkpointer: memory  # Se pierde todo al reiniciar
```

**Con PostgreSQL (producción):**
```bash
# 1. Instala PostgreSQL (o usa Docker)
docker run --name harness-db \
  -e POSTGRES_PASSWORD=secure-password \
  -e POSTGRES_DB=harness \
  -p 5432:5432 \
  postgres:15

# 2. En .env:
CHECKPOINT_DB_URL=postgresql://postgres:secure-password@localhost:5432/harness

# 3. Ahora el harness guarda el estado de cada ticket
# Si falla en el paso 5, puedes volver al paso 3 y reintentar solo desde ahí
```

**Coste:** $15-30/mes en cualquier proveedor cloud (Heroku, Railway, Fly.io)

### 6.7.2 Monitoreo y observabilidad (LangSmith)

**¿Por qué?** Para ver exactamente qué hace el harness en cada ticket (qué tokens usa, en qué se tarda, dónde falla).

```bash
# 1. Crea cuenta en https://smith.langchain.com (es gratis)

# 2. En .env:
LANGCHAIN_API_KEY=sk-...
LANGSMITH_API_KEY=ls-...
LANGSMITH_PROJECT=harness-production

# 3. Ahora cada ticket genera un trace que ves en https://smith.langchain.com
# Visualizas: Knowledge Engine → Planner → Implementation → Validation → Recovery
# Con tiempos, tokens, decisiones y errores de cada nodo
```

**Coste:** Gratis en plan básico (hasta 1000 traces/mes)

### 6.7.3 Git hooks (automatizar mejor)

El harness debe ejecutarse cuando se abre un PR o se crea un ticket. Usa webhooks:

```bash
# En GitHub: Settings → Webhooks → Add webhook
# Payload URL: https://tu-harness.ejemplo.com/webhooks/github
# Eventos: Issues opened, Pull requests opened

# En Jira: Settings → Apps → Webhooks
# URL: https://tu-harness.ejemplo.com/webhooks/jira
# Eventos: Issue created, Issue updated
```

Con esto, el harness se lanza automáticamente, sin que escribas comandos manuales.

### 6.7.4 Logging y alertas (Sentry, LogRocket)

Cuando el harness falla, saberlo inmediatamente:

```bash
# 1. Crea cuenta en https://sentry.io (gratis)

# 2. En .env:
SENTRY_DSN=https://...@sentry.io/...

# 3. Ahora si algo explota, te llega un email/Slack
```

**Configuración de alertas:**
```yaml
# config/orchestrator.yml
alerts:
  slack:
    webhook: https://hooks.slack.com/services/...
    events:
      - ticket_failed
      - budget_exceeded
      - recovery_escalated
```

### 6.7.5 Control de permisos y auditoría

**¿Quién puede hacer qué?** Define roles:

```yaml
# config/permissions.yml
roles:
  admin:
    can: [create_tickets, approve_merges, modify_rules, view_all_logs]
  harness_user:
    can: [create_tickets, view_own_tickets]
  auditor:
    can: [view_all_logs, view_all_tickets]  # Sin poder modificar

audit_log:
  enabled: true
  storage: postgresql  # Se guarda todo para compliance
```

### 6.7.6 Versionado de configuración

Todo en `.harness/` es código — trata como tal:

```bash
# .harness/ debe estar en git
git add .harness/
git commit -m "feat: añadir rule no-modify-secrets"
git push

# Cada cambio de reglas/governance se puede auditar:
git log .harness/governance/
git show <commit>  # Ve exactamente qué regla cambió y cuándo
```

### 6.7.7 Integración con CI/CD (GitHub Actions, GitLab CI)

Ejecuta el harness automáticamente en cada push:

```yaml
# .github/workflows/harness.yml
name: Automated Implementation

on:
  issues:
    types: [opened, labeled]

jobs:
  harness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Harness
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npm ci
          npm run harness:execute -- --ticket-id ${{ github.event.issue.number }}
      - name: Report
        if: always()
        run: npm run harness:report
```

Con esto, abres un issue → el harness lo implementa automáticamente → commit + merge si todo pasó.

### 6.7.8 Tabla: Setup Mínimo vs Producción

| Componente | Mínimo | Producción | Por qué |
|---|---|---|---|
| Node.js 18+ | ✅ | ✅ | Runtime |
| SSH keys | ✅ | ✅ | Seguridad en git |
| Docker | ⚠️ Opcional | ✅ | Sandbox seguro |
| PostgreSQL | ❌ | ✅ | Checkpoints durables |
| LangSmith | ❌ | ✅ | Observabilidad |
| Sentry | ❌ | ✅ | Alertas de fallos |
| Git webhooks | ❌ | ✅ | Automatización |
| GitHub Actions | ❌ | ✅ | CI/CD |
| Logging | ❌ | ✅ | Auditoría |

---

## Parte 7: Resumen de lo que acabas de hacer

| Paso | Duración | Qué hiciste |
|---|---|---|
| 1. Setup | 15 min | Node.js, dependencias, directorios |
| 2. Harness base | 30 min | Orchestrator, config de providers |
| 3. Proyecto destino | 45 min | `.harness/rules`, `architecture`, `governance`, `validation` |
| 4. Primer ticket | 30 min | Ejecutaste el flujo completo (search → plan → implement → validate → merge) |
| 5. Debugging | — | Resolviste problemas comunes |

**Total: ~2.5 horas** hasta tener un ticket completamente automatizado.

---

## Parte 8: Checklist de "estoy listo"

### 8.1 Checklist MVP (Funcionamiento básico)

Marca cada una cuando la completes:

- [ ] Tengo Node.js 18+ instalado
- [ ] Tengo SSH configurado y funciona (`ssh -T git@github.com`)
- [ ] Tengo Docker instalado y funciona (`docker run hello-world`)
- [ ] Creé la estructura de directorios del harness
- [ ] Creé `.env` con API key válida (Anthropic/OpenAI/OpenRouter)
- [ ] Creé `config/providers.yml` con mis roles
- [ ] En mi proyecto destino, creé `.harness/rules/`, `.harness/architecture/`, `.harness/governance/`
- [ ] Creé `config/validation-pipeline.yml` con mis comandos (compile, test, lint, etc.)
- [ ] Ejecuté el harness con un ticket simple
- [ ] El harness hizo search + plan + implementation + validation
- [ ] El merge salió bien

Si todas tienen ✅, **MVP listo**. Puedes empezar a usar el harness.

### 8.2 Checklist Producción (Setup Robusto)

Cuando estés listo para ir en serio:

- [ ] PostgreSQL o cloud database configurada (`CHECKPOINT_DB_URL` en `.env`)
- [ ] LangSmith conectado para observabilidad (`LANGSMITH_API_KEY`)
- [ ] Sentry conectado para alertas (`SENTRY_DSN`)
- [ ] Git webhooks configurados en GitHub/Jira
- [ ] GitHub Actions workflow creado en `.github/workflows/harness.yml`
- [ ] Permisos y roles configurados en `config/permissions.yml`
- [ ] `.harness/` está versionado en git
- [ ] Logs configurados y enviados a storage durable
- [ ] Backup de checkpoints configurado
- [ ] Alerts en Slack/email configuradas

Si todas tienen ✅, **producción lista**. El harness puede correr automáticamente 24/7.

---

## Parte 9: Próximos pasos

### Fase 1: MVP a Escalable (Semana 1-2)

Ahora que funciona lo básico:

1. **Ajusta presupuestos** (Parte 6.2) — evita gastar dinero innecesariamente
   ```yaml
   orchestrator:
     costLimitPerDay: 10.0  # Empieza con $10/día
   ```

2. **Añade más tickets** — el harness mejora con más datos de ejecución
   - Crea 5-10 tickets reales y deja que el harness los implemente
   - Revisa los logs, detecta patrones

3. **Tuning de gobernanza** — ajusta `.harness/governance/*.md` según lo que veas fallar
   - Si muchos tickets se van a Recovery, revisa rules de Architecture
   - Si el costo es alto, cambia a provider más barato en ciertos roles

### Fase 2: MVP a Producción (Semana 3+)

Cuando estés contento con los resultados:

4. **Configura PostgreSQL** (Parte 6.7.1)
   - Usa un servicio cloud (Heroku, Railway, PlanetScale)
   - Conecta con `CHECKPOINT_DB_URL`

5. **Observabilidad** (Parte 6.7.2)
   - Conecta LangSmith para ver exactamente qué hace el harness
   - Crea dashboard en LangSmith con métricas por rol

6. **Alertas** (Parte 6.7.4)
   - Configura Sentry para errores
   - Configura Slack webhook para notificaciones

7. **Integración con CI/CD** (Parte 6.7.7)
   - Añade GitHub Actions que lance el harness automáticamente
   - Ahora: issue abierto → harness lo implementa → merge automático

### Fase 3: 24/7 Automation (Mes 2+)

Cuando todo está estable:

8. **Permisos y seguridad** (Parte 6.7.5)
   - Define quién puede crear tickets, aprobar merges, modificar rules
   - Audita todos los cambios

9. **Monitoreo en tiempo real**
   - Dashboard en LangSmith mostrando estado en vivo
   - Alertas por Slack si algo falla

10. **Análisis de datos**
    - Cuánto ahorras en desarrollo manual
    - Qué tipos de tickets el harness maneja mejor
    - Dónde se va el dinero (qué roles gastan más)

---

## Parte 12: Glosario (¿qué significa "X"?)

### Conceptos del Harness

- **Agent / Agente**: Un modelo de IA que puede tomar decisiones y ejecutar acciones
- **Loop**: Un ciclo que se repite hasta que se cumple una condición (ej. "buscar información hasta que sea suficiente")
- **Token**: Palabra o fracción de palabra. Claude procesa tokens. 1 token ≈ 4 caracteres
- **Checkpoint**: Un punto de guardado — el harness guarda el estado después de cada paso, puede volver a cualquier punto anterior si algo falla
- **Patch**: Cambio de código, formato de "diferencia" (antes/después de cada línea modificada)
- **Validation Pipeline**: Serie de pruebas (compile, tests, lint, seguridad) que valida que el código está listo
- **Recovery Loop**: Cuando algo falla, IA intenta diagnóstico y estrategia para arreglarlo sin reintentar lo mismo
- **Quality Gate**: Revisión holística final (cobertura, arquitectura, docs, deuda técnica) antes de mergear
- **Merge Manager**: Automatización final que hace `git merge`, crea tags y cierra tickets

### Seguridad y Herramientas

- **SSH**: Protocolo seguro para conectar a GitHub sin contraseña. La clave privada (`~/.ssh/id_ed25519`) es tu identidad
- **API Key**: Token secreto que permite acceder a servicios (Anthropic, OpenAI, etc.). NUNCA commitees en git
- **Docker**: Software que crea "mini-máquinas virtuales" (contenedores) aisladas. El harness corre dentro, no puede tocar tu PC
- **Contenedor**: Mini-máquina Linux descartable. Si se rompe, la descartas (`docker rm`), tu PC está intacto
- **Sandbox**: Ambiente aislado donde el harness prueba código. Con Docker, es un contenedor
- **Rollback**: Volver a un punto anterior en git. Con checkpoints, volver a un paso anterior en la ejecución

### Configuración

- **Provider**: Servicio de IA (Anthropic/Claude, OpenAI/GPT, OpenRouter, etc.). Puedes tener múltiples
- **Role**: Un rol del harness (discovery, planner, implementer, etc.) asignado a un modelo específico
- **Config por capas**: Archivos `.yml` en `.harness/` que definen rules, architecture, governance. Se cargan por prioridad (global → proyecto → local)

### Monitoreo

- **Checkpointer**: Sistema que guarda el estado del harness después de cada paso. Puede ser memoria o PostgreSQL
- **LangSmith**: Herramienta que ve "la película" de qué hizo el harness (cada paso, tiempo, tokens, decisiones)
- **Sentry**: Herramienta que te avisa si el harness explota (errores, excepciones)
- **Audit log**: Registro de todo lo que el harness hizo, quién lo autorizó, cuándo. Para compliance y debugging

---

## Parte 10.5: ¿Por qué Docker es CRÍTICO? (Explicación visual)

### El problema sin Docker

Imagina que el harness genera código buggy:

```typescript
// El harness genera accidentalmente esto:
rm -rf /  // ¡OOPS! Borra TODA tu computadora

// Sin Docker:
$ npm run harness
# ... código malvado se ejecuta ...
# 💀 Tu computadora explota. Pierdes TODO.

// Con Docker:
$ npm run harness
# ... código malvado se ejecuta DENTRO de un contenedor ...
# Contenedor explota. Ejecutas:
$ docker rm -f contenedor-enfermo
# 💚 Tu computadora está perfecta. Zero impacto.
```

### Diagrama: Arquitectura SIN Docker (INSEGURA)

```
┌─────────────────────────────────────────┐
│         Tu computadora (real)           │
│  ┌─────────────────────────────────────┐│
│  │ Tu código real                      ││
│  │ Tu .env (con API keys reales)       ││
│  │ Tu base de datos (datos reales)     ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ Harness ejecutándose (sin aislamiento)
│  │ Puede tocar TODO ⚠️⚠️⚠️             ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
        PELIGRO: Harness y datos reales juntos
```

### Diagrama: Arquitectura CON Docker (SEGURA)

```
┌──────────────────────────────────────────────┐
│       Tu computadora (segura)                │
│  ┌────────────────────────────────────────┐ │
│  │ Tu código real 🔒                      │ │
│  │ Tu .env (intacto) 🔒                   │ │
│  │ Tu base de datos (intacto) 🔒         │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │    CONTENEDOR DOCKER #1 (descartable) │ │
│  │  Harness copia del repo                │ │
│  │  Harness hace cambios AQUÍ             │ │
│  │  Si explota: $ docker rm               │ │
│  │  Nada fuera del contenedor se toca ✅  │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │    CONTENEDOR DOCKER #2 (descartable) │ │
│  │  Harness copia del repo                │ │
│  │  Harness hace cambios AQUÍ             │ │
│  │  Independiente del #1 ✅               │ │
│  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
        SEGURO: Harness aislado en burbujas
```

### Ventajas de Docker en una tabla

| Aspecto | Sin Docker | Con Docker |
|---|---|---|
| **¿Qué pasa si el harness buggy ejecuta `rm -rf /`?** | Tu disco explota | Contenedor explota, tu PC está intacto |
| **¿Qué pasa si falla una compilación?** | Deja archivos temporales basura en tu máquina | Se descarta el contenedor, limpio automático |
| **¿Diferencias entre mi máquina y el servidor?** | Sí → "funciona en mi máquina pero en prod explota" | No → exacto mismo ambiente en todos lados |
| **¿Puedo ejecutar 2 harnesses simultáneamente?** | Conflictos, cosas raras | Cada uno en su contenedor, aislados |
| **¿Qué pasa si contamino variables de entorno?** | Afecta todo lo que corro luego | Solo afecta ese contenedor |
| **Rollback si algo salió mal** | Restaurar backup (horas) | `docker rm`, listo (segundos) |

### Ejemplo real: Harness sin Docker (HORROR)

```bash
# 1. Abres un ticket: "Actualizar MySQL version"
# 2. El harness intenta compilar con la nueva versión
# 3. Falla con un error raro de compatibilidad
# 4. El harness deja el archivo de configuración modificado
# 5. Cierras el harness, intentas correr tu app local
# 6. Tu app explota porque la config está rota
# 7. Pasas 2 horas debuggeando porque no sabías que el harness modificó el config
```

**Con Docker:**
```bash
# Exacto lo mismo, pero:
# 5. Cierras el harness, descartas el contenedor
# 6. Tu app local corre perfecto, el config está intacto
# 7. Cero confusión
```

---

---

## Parte 13: Arquitectura Completa (Cómo encajan todos los piezas)

Aquí está TODO conectado. Si ves este diagrama y lo entiendes, estás listo:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USUARIO: Abre un ticket                          │
│                     "Agregar validación de email"                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  GitHub/Jira                      (Tu sistema de tracking)              │
│  Webhook dispara automáticamente al harness                             │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Orchestrator (Capa 1)                                                   │
│  • Lee el ticket                                                        │
│  • Carga configuración (providers.yml, .harness/rules/*.md)            │
│  • Guarda checkpoint en PostgreSQL                                      │
│  • Decide: ¿buscar contexto? → Sí                                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Knowledge Engine (Capa 2)                                               │
│  • Busca en el repo: ¿dónde está ValidationService?                    │
│  • Usa ts-morph (AST) + TF-IDF/coseno (sin embeddings) + grep            │
│  • Verifica: ¿la evidencia es suficiente?                               │
│  • Resultado: confirmedEvidence[] (no doc completos)                    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Planner (Capa 3)                                                        │
│  • Discovery: analiza el ticket + evidencia                             │
│  • Planning: genera plan (Task 1: update service, Task 2: update tests) │
│  • Validation: ¿el plan respeta .harness/architecture/adr/*.md?         │
│  • Resultado: plan validado                                             │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼ (para cada task en el plan)
┌─────────────────────────────────────────────────────────────────────────┐
│  Docker Container (Sandbox)                                              │
│  • Copia del repo se crea AQUÍ (no toca tu máquina)                    │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Implementation Loop (Capa 4)                                      │ │
│  │ • Genera código: "añade validateEmail() a ValidationService"     │ │
│  │ • Genera tests: "añade test para email válido/inválido"          │ │
│  │ • Quick-check local: ¿compila? ✅ (antes de Capa 5)             │ │
│  └──────────────────────┬──────────────────────────────────────────┘ │
│                         │                                              │
│  ┌──────────────────────▼──────────────────────────────────────────┐ │
│  │ Validation Pipeline (Capa 5)                                    │ │
│  │ • Compile: npm run build ✅                                    │ │
│  │ • Tests: npm test ✅ (todas pasan)                            │ │
│  │ • Lint: eslint ✅                                             │ │
│  │ • Security: npm audit ✅                                      │ │
│  │ • Performance: benchmark (si aplica) ⏭️                       │ │
│  │ • failureCategory: null (todo pasó)                           │ │
│  └──────────────────────┬──────────────────────────────────────────┘ │
│                         │                                              │
│                    PASSED (✅)                                         │
│  El contenedor se descarta (todos sus cambios se guardaron como patch) │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Recovery Loop (Capa 6)                                                  │
│  • failureCategory = null → Sin errores, no necesita recovery           │
│  • Salta esta capa                                                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Quality Gate (Capa 7)                                                   │
│  • Coverage: 95% → 96% (+1%) ✅                                        │
│  • Sonar: 0 code smells nuevos ✅                                      │
│  • Architecture: respeta .harness/architecture/*.md ✅                  │
│  • Documentation: comentarios en métodos nuevos ✅                      │
│  • Verdict: CLEAR                                                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Merge Manager (Capa 8)                                                  │
│  • git merge (vía SSH, seguro)                                          │
│  • Crea tag: ticket-PROJ-123                                            │
│  • Cierra el ticket en GitHub/Jira                                      │
│  • Push a main                                                          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Observabilidad y Auditoría                                              │
│  • LangSmith: Registra cada paso (Knowledge → Plan → Implement → Valid) │
│  • PostgreSQL Checkpoints: Guarda estado para time-travel                │
│  • Sentry: Si algo falló, aviso por email/Slack                         │
│  • GitHub/Jira: Ticket comentado con detalles del merge                 │
│  • Audit log: Quién autorizó, cuándo, qué cambió                        │
└────────────────────────────────────────────────────────────────────────┘

TIEMPO TOTAL: ~2-5 minutos (todo automático, sin intervención humana)
COSTO: $0.50 - $2.00 en tokens de IA
RESULTADO: Código real, mergeado, en producción
```

### Qué hace CADA herramienta instalada:

| Herramienta | Instalaste en | Qué hace en este flujo |
|---|---|---|
| **Node.js** | Parte 1 | Corre todo el harness (Orchestrator → Merge Manager) |
| **SSH** | Parte 1.2 | Permite que el Merge Manager haga `git push` sin contraseña |
| **Docker** | Parte 1.3 | Crea el contenedor aislado donde runs Implementation + Validation |
| **Git** | Parte 1.4 | Copia del repo, merges, tags, pushes |
| **providers.yml** | Parte 2.4 | Define qué modelo de IA para cada rol (Orchestrator → Discovery → ...) |
| **.harness/rules/*.md** | Parte 3.2 | Reglas que NO se pueden violar (forbidden zones, coding style) |
| **.harness/architecture/*.md** | Parte 3.3 | Descripción de la arquitectura (patrones, ADRs) para que Quality Gate la valide |
| **.harness/governance/*.md** | Parte 3.4 | Reglas de qué se permite automático vs. qué requiere humano |
| **validation-pipeline.yml** | Parte 3.5 | Comandos a ejecutar (npm test, eslint, npm audit, etc.) |
| **PostgreSQL** | Parte 6.7.1 | Guarda checkpoints de cada step (para time-travel si falla) |
| **LangSmith** | Parte 6.7.2 | Dashboard que muestra "la película" de qué hizo el harness |
| **Sentry** | Parte 6.7.4 | Alertas si algo explota (email/Slack inmediato) |
| **GitHub Actions** | Parte 6.7.7 | Dispara el harness automáticamente al abrir tickets |

---

---

## Parte 14: "Quiero experimentar rápido"

Si solo quieres probar sin usar tu proyecto real, esto SÍ existe hoy:

```bash
cd multiagent-harness

# Backlog de demo hardcodeado (3 tickets sobre este mismo repo)
npm run dev

# O cada capa por separado, aislada del resto (Knowledge Engine, Planner,
# Implementation, Validation, Recovery, Quality Gate, Merge Manager):
npm run kb:demo
npm run planner:demo
npm run implementation:demo
npm run validation:demo
npm run recovery:demo
npm run quality-gate:demo
npm run merge-manager:demo
```

La Opción B (usar un repo de prueba separado con `--target`) está IMPLEMENTADA
desde Phase 1 (2026-07-30). El harness ahora soporta arbitrary target repositories
mediante el parámetro `--target /path/to/repo`. Ver `PRODUCTION.md` para detalles
de deployment con target repos reales.

---

## Parte 15: Resumen Final

**Lo que instalaste:**
- ✅ Node.js 18+ (runtime)
- ✅ SSH (seguridad en git)
- ✅ Docker (sandboxing)
- ✅ npm packages (LangGraph, Zod, dotenv, etc.)
- ✅ Configuración de providers (Anthropic/OpenAI/OpenRouter)
- ✅ `.harness/` con rules/architecture/governance
- ✅ `validation-pipeline.yml` con tus comandos

**Lo que hace ahora:**
- ✅ Lee tickets automáticamente
- ✅ Busca contexto en tu repo (Knowledge Engine)
- ✅ Hace un plan (Planner)
- ✅ Genera código en sandbox (Implementation)
- ✅ Valida con herramientas reales (compile, tests, lint, security)
- ✅ Si falla, intenta arreglarlo (Recovery)
- ✅ Revisa arquitectura/cobertura (Quality Gate)
- ✅ Mergea y cierra el ticket (Merge Manager)

**Tiempo total de setup:** ~4 horas
**Tiempo por ticket:** ~2-5 minutos (automático)
**ROI:** Cada ticket = 2-3 horas de desarrollo manual ahorradas

**Próximo paso:** Crea tu primer ticket real y observa cómo el harness lo implementa automáticamente. 🚀

---

**¿Preguntas?**
- Abre un issue en el repo del harness
- Consulta las guías técnicas de cada capa (Capas 1-8)
- Ve a LangSmith para ver exactamente qué hizo el harness

**Bienvenido al futuro de la automatización de desarrollo.**
