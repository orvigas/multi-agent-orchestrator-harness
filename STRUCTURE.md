# Estructura del Repositorio Reorganizado

## Resumen de cambios

El harness ahora es **completamente independiente** del proyecto host. Vive en su propio directorio (`harness/`) con su propia estructura, configuración y dependencias.

## Estructura actual

```
.
├── .claude/                     # Claude Code config (compartido)
├── .codegraph/                  # Índice de code intelligence (compartido)
├── .harness/                    # Contexto compartido (rules, architecture, governance)
│   ├── architecture/
│   ├── governance/
│   ├── rules/
│   ├── releases.jsonl
│   └── runs.jsonl
│
├── src/                         # PROYECTO HOST
│   ├── build-systems/           # Compiladores, build tools
│   ├── languages/               # Detección de lenguajes
│   ├── parsers/                 # Parsers de código (Java, Python, Go, Rust, etc.)
│   ├── validators/              # Validadores de código
│   ├── test-runners/            # Ejecución de tests
│   ├── persistence/             # Persistencia de datos
│   ├── utils/                   # Utilidades generales
│   └── services/                # Servicios específicos del host
│
├── harness/                     # HARNESS INDEPENDIENTE (removible)
│   ├── src/
│   │   ├── orchestrator/        # Capa 0: Orquestador principal
│   │   ├── workflows/           # Capas 1-7: Motores del harness
│   │   │   ├── knowledge-engine/
│   │   │   ├── planner/
│   │   │   ├── implementation/
│   │   │   ├── validation-pipeline/
│   │   │   ├── recovery/
│   │   │   ├── quality-gate/
│   │   │   └── merge-manager/
│   │   ├── services/            # Servicios del harness (LLM, tokens, etc.)
│   │   ├── config/              # Loaders de configuración YAML
│   │   ├── index.ts             # Entry point del harness
│   │   ├── e2e.test.ts          # Tests E2E del harness
│   │   └── index.test.ts        # Tests del harness
│   │
│   ├── config/                  # YAML config (independiente)
│   │   ├── providers.yml        # Providers LLM (Anthropic, OpenAI, etc.)
│   │   ├── orchestrator.yml     # Config del orquestador
│   │   ├── knowledge-engine.yml
│   │   ├── planner.yml
│   │   ├── implementation.yml
│   │   ├── validation-pipeline.yml
│   │   ├── recovery.yml
│   │   ├── quality-gate.yml
│   │   ├── merge-manager.yml
│   │   └── languages.yml        # Lenguajes soportados
│   │
│   ├── package.json             # Dependencias independientes del harness
│   ├── tsconfig.json            # TypeScript config del harness
│   ├── .gitignore               # Reglas gitignore del harness
│   ├── .env.example             # Variables de entorno del harness
│   ├── .env                     # Configuración actual del harness
│   ├── .env.production          # Config de producción del harness
│   └── README.md                # Documentación del harness
│
├── package.json                 # Dependencias del proyecto host (MINIMAL)
├── tsconfig.json                # TypeScript config del host
├── .gitignore                   # Reglas gitignore del proyecto
└── CLAUDE.md                    # Esta documentación
```

## Qué es compartido

**Única intersección entre host y harness:**

- `.harness/` — Archivos de contexto (rules, architecture, governance)
- `.codegraph/` — Índice de code intelligence
- `.claude/` — Configuración de Claude Code

## Independencia del Harness

El harness puede ser **removido completamente** sin afectar el proyecto host:

```bash
rm -rf harness/  # ✅ El host sigue funcionando normalmente
```

El harness:
- ✅ Tiene su propio `package.json` con sus dependencias
- ✅ Tiene su propia configuración en `harness/config/`
- ✅ Tiene su propio `.env` en `harness/`
- ✅ NO toca nada fuera de `harness/` (excepto `.harness/` que lee)

## Flujo de trabajo

### Trabajar con el host

```bash
# En la raíz
npm install                 # Instalar deps del host
npm run typecheck          # Type-check
npm run test:parsers       # Tests de parsers
npm run test:validators    # Tests de validators
```

### Trabajar con el harness

```bash
# En harness/
cd harness
npm install                 # Instalar deps del harness

# Configurar
cp .env.example .env       # Ajustar con API keys
cd ..

# Desde raíz
cd harness
npm run dev                # Ejecutar harness
npm run typecheck          # Type-check del harness
npm test                   # Tests del harness
npm run kb:demo            # Demo de Knowledge Engine
npm run planner:demo       # Demo de Planner
```

## Búsqueda de contexto

`harness/src/config/loadContext.ts` busca `.harness/` **hacia arriba** desde el directorio actual:

1. Comienza en `process.cwd()` (raíz del proyecto)
2. Busca `.harness/` subiendo hacia la raíz del filesystem
3. Usa el primero que encuentra (siempre será `{proyecto-root}/.harness/`)

Esto permite que el harness funcione correctamente sin importar desde dónde se ejecute.

## Migración completada

✅ Harness desacoplado del host  
✅ Configuraciones independientes  
✅ Estructura clara y modular  
✅ Sin dependencias entre proyectos (excepto contexto compartido)  
✅ El host puede evolucionar sin cambiar el harness  
✅ El harness puede ser actualizado/removido sin afectar el host  
