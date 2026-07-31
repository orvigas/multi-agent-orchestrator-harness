# Getting Started — Setup del Harness desde 0

Guía completa para configurar el Multi-Agent Orchestrator Harness en un proyecto nuevo desde cero hasta ejecutar el primer ticket.

**Tiempo estimado:** 15-20 minutos

---

## Requisitos Previos

- **Node.js** v18+
- **npm** 9+
- **API Key de Anthropic** (para LLM mode) — obtener en https://console.anthropic.com
- **Target Repository** (opcional): Un repositorio de código para procesar

Verifica:
```bash
node --version   # v18 o superior
npm --version    # 9 o superior
```

---

## Paso 1: Preparar el Ambiente

### 1.1 Obtener API Key de Anthropic

1. Ve a https://console.anthropic.com/account/keys
2. Crea una nueva API key
3. Cópiala (la necesitarás en el próximo paso)

**Nota:** El harness también soporta OpenAI, OpenRouter como fallback. Ver `harness/config/providers.yml`.

### 1.2 Estructura de directorios

Si empiezas desde 0, la estructura será:

```
my-project/
├── harness/              # ← El harness (este repo)
├── target-repo/          # ← Repositorio a procesar (opcional)
└── .harness/             # ← Contexto compartido (crearemos si no existe)
```

Si quieres usar un repositorio existente:

```bash
# Opción 1: Dentro del repositorio existente
cd /ruta/a/mi-repo
git clone https://github.com/tu-org/harness harness
cd harness

# Opción 2: En paralelo (recomendado para desarrollo)
mkdir orchestrator-workspace
cd orchestrator-workspace
git clone https://github.com/tu-org/harness harness
# target-repo estará en /ruta/externa/...
```

---

## Paso 2: Instalar Dependencias del Harness

```bash
cd harness
npm install
```

Espera a que terminen las instalaciones (puede tomar 2-3 minutos).

Verifica la instalación:
```bash
npm run typecheck
```

Debería no reportar errores.

---

## Paso 3: Configurar Variables de Entorno

### 3.1 Crear `.env`

```bash
cd harness
cp .env.example .env
```

### 3.2 Editar `.env`

Abre `harness/.env` y configura:

```bash
# ============================================
# API KEY (obligatorio)
# ============================================
ANTHROPIC_API_KEY=sk-ant-v0-... # Tu key de Anthropic

# ============================================
# LLM CONFIGURATION
# ============================================
HARNESS_MODE=deterministic  # o "llm" para modo real

# Para modo LLM:
# Cambiar a:
HARNESS_MODE=llm

# ============================================
# DATABASE
# ============================================
CHECKPOINT_DB_PATH=./data/harness-checkpoints.db

# ============================================
# OBSERVABILITY (opcional)
# ============================================
# LANGCHAIN_TRACING_V2=true
# LANGCHAIN_API_KEY=ls-...

# ============================================
# DEPLOYMENT (opcional)
# ============================================
# NODE_ENV=production
```

**Notas importantes:**

- **`HARNESS_MODE=deterministic`**: Ejecuta con lógica determinística (sin LLM). Perfecto para probar la estructura.
- **`HARNESS_MODE=llm`**: Usa Claude real. Requiere ANTHROPIC_API_KEY válida.
- **`CHECKPOINT_DB_PATH`**: Dónde guardar el estado entre ejecuciones (SQLite).

---

## Paso 4: Crear el Contexto Compartido (`.harness/`)

El `.harness/` contiene reglas, arquitectura y gobernanza que el harness usará.

### 4.1 Estructura básica

```bash
mkdir -p .harness/rules
mkdir -p .harness/architecture
mkdir -p .harness/governance
```

### 4.2 Crear archivos básicos

**`.harness/rules/forbidden-zones.md`:**

```markdown
# Forbidden Zones

Archivos/directorios que el harness NUNCA puede modificar:

## Absoluto (nunca)
- secrets/
- .env*
- **/*.pem
- **/*.key
- node_modules/
- vendor/
- dist/  (si no se regenera)
- .git/

## Condicional (casos especiales)
- legacy/  (solo con aprobación manual)
- migrations/  (requiere review especial)
```

**`.harness/architecture/patterns.md`:**

```markdown
# Arquitectura y Patrones

## Convenciones de Código

- TypeScript: Strict mode, tipos explícitos
- Naming: camelCase para variables, PascalCase para clases
- Testing: Tests colocales (`*.test.ts`)
- Imports: Rutas relativas dentro del módulo

## Áreas Sensibles a Rendimiento

- Database queries: Evitar N+1
- File I/O: Usar buffers para archivos grandes
- Memory: No cargar archivos completos en memoria

## Dependencias Prohibidas

- No agregar dependencias sin review
- Mantener count < 50 (incluir devDeps)
```

**`.harness/governance/implementation.md`:**

```markdown
# Implementation Loop Policy

## Reglas Duras

1. **Never modify forbidden zones** (.env, secrets/, .git/, etc.)
2. **Sanity checks required** before applying patches
3. **Sandbox execution mandatory** — apply in temp copy first
4. **Quick-check needed** — compile + 1 test minimum

## Escalation Triggers

- Security issue found → Always escalate
- Build failure → Retry up to 3x, then escalate
- Test failure → Diagnose root cause, not blind retry
- Architecture violation → Manual review required

## Recovery Strategy Limits

- Max recovery iterations: 3
- Max retries per strategy: 2
- If repeated failure → Force strategy change
```

### 4.3 Copiar desde template (si existe)

Si ya tienes contexto definido:

```bash
# Ejemplo: desde este repositorio
cp -r /ruta/a/repo/.harness/* .harness/
```

---

## Paso 5: Prueba Inicial (Deterministic Mode)

Ejecuta el harness en modo determinístico (sin llamadas LLM):

```bash
cd harness

# Ejecutar con modo determinístico (por defecto)
npm run dev
```

**Qué debería pasar:**

1. Se carga la configuración
2. Se procesan tickets de demostración
3. Se crea `data/harness-checkpoints.db` (SQLite)
4. Se escriben logs con decisiones

**Si hay error:**

- Verifica que `HARNESS_MODE=deterministic` está en `.env`
- Verifica que `ANTHROPIC_API_KEY` está definida (puede ser vacía en modo determinístico)
- Revisa la consola para mensajes de error específicos

---

## Paso 6: Prueba con LLM (Opcional)

Cuando estés listo para usar Claude real:

```bash
# 1. Actualizar .env
# HARNESS_MODE=llm

# 2. Asegurarte de que ANTHROPIC_API_KEY es válida

# 3. Ejecutar
cd harness
npm run dev
```

**Coste estimado:** $0.10 - $1.00 USD por ticket (depende de complejidad).

---

## Paso 7: Crear tu Primer Ticket

Ver **[REQUIREMENTS_CAPTURE.md](./REQUIREMENTS_CAPTURE.md)** para:

1. Cómo capturar requerimientos
2. Cómo crear tickets
3. Cómo configurar el target repository
4. Cómo ejecutar el harness contra tickets reales

---

## 🔧 Comandos Útiles

```bash
cd harness

# Type-check
npm run typecheck

# Correr tests
npm test

# Ver logs del último run
npm run logs

# Ver costos de LLM del último run
npm run costs

# Demo de una capa específica
npm run kb:demo          # Knowledge Engine
npm run planner:demo     # Planner
npm run recovery:demo    # Recovery Loop
```

---

## 🐛 Troubleshooting

### Error: "Cannot find module"

```bash
# Solución: reinstalar dependencias
cd harness
rm -rf node_modules package-lock.json
npm install
```

### Error: "ANTHROPIC_API_KEY is required"

```bash
# Incluso en modo determinístico, necesita existir (puede ser vacía)
# Verifica .env tenga:
# ANTHROPIC_API_KEY=test-key-for-deterministic-mode
```

### Error: "SQLITE_BUSY: database is locked"

```bash
# Solo una instancia del harness puede ejecutarse
# Mata procesos node existentes:
pkill -f "node.*index.ts"
# Intenta nuevamente
```

### Error: ".harness directory not found"

```bash
# Crea la estructura básica:
mkdir -p .harness/{rules,architecture,governance}

# O copia desde template:
cp -r /path/to/template/.harness .
```

---

## ✅ Checklist de Setup Completado

- [ ] Node.js v18+ instalado
- [ ] Dependencias del harness instaladas (`npm install`)
- [ ] `.env` creado y configurado
- [ ] `.harness/` creado con reglas básicas
- [ ] Primera ejecución exitosa (`npm run dev`)
- [ ] Listo para capturar requerimientos

---

## 🎯 Próximo Paso

Ahora que tienes el harness listo, ve a **[REQUIREMENTS_CAPTURE.md](./REQUIREMENTS_CAPTURE.md)** para:

1. Entender cómo capturar requerimientos del usuario
2. Crear tickets en formato que el harness entienda
3. Ejecutar el primer ticket real
4. Interpretar resultados

---

**Documentación relacionada:**
- `.claude/CLAUDE.md` — Arquitectura técnica
- `STRUCTURE.md` — Estructura de directorios
- `loops_prompts/` — Diseño de capas
- `.harness/governance/` — Políticas por capa

