# How-To: Construir el Orchestrator (Capa 1) con LangGraph, 100% reutilizable

## 0. Decisión de stack: LangGraph.js (TypeScript/Node.js)

Dijiste "algo como LangGraph o con Node.js" — buena noticia: no tienes que elegir entre ambos.

`@langchain/langgraph` (LangGraph.js) es el puerto oficial de LangGraph a TypeScript, mantenido por el mismo equipo, y alcanzó paridad de funciones con la versión Python durante 2025-2026: StateGraph, edges condicionales, checkpointers (Memory/SQLite/Postgres/Mongo/Redis), `interrupt()` para human-in-the-loop, subgrafos, streaming y el Store API para memoria cross-thread.

Motivos concretos para tu caso:

- **Reutilizable sin importar el stack técnico del proyecto destino**: si el módulo corre en Node.js, se integra de forma nativa en cualquier backend JS/TS (Express, Nest, Next API routes) sin levantar un sidecar en Python.
- **Corre en más entornos**: Node.js, Deno, Cloudflare Workers, Vercel Edge — útil si algún día quieres ofrecer el orchestrator como servicio serverless.
- **Tipado fuerte**: los esquemas de estado con `Annotation` + Zod te dan verificación en compilación, algo valioso para un módulo que otros equipos van a configurar y extender.

Trade-off honesto: la documentación y los ejemplos de LangGraph siguen siendo más abundantes en Python, y algunos equipos TS reportan que la API "se siente" traducida de Python (objetos de estado mutables, funciones de edge condicional que devuelven nombres de nodo como string). Si tu equipo va a hacer *mucho* trabajo de orquestación compleja (map-reduce, swarms) y no le importa un runtime Python separado, Python sigue siendo la opción con más ejemplos de referencia. Pero para tu objetivo — módulo reutilizable, agnóstico de stack, embebible en Node — LangGraph.js es la elección correcta.

```bash
npm install @langchain/langgraph @langchain/core @langchain/anthropic @langchain/openai zod dotenv js-yaml
```

---

## 1. Qué hace el Orchestrator y qué NO hace

Según tu propio diseño, el Orchestrator:

- Nunca escribe código.
- Solo responde "¿qué sigue?".
- Mantiene: backlog, estado, memoria, retries, prioridades, checkpoints, presupuesto de tokens, presupuesto de costo, tiempo.
- Decide: continuar / reintentar / cambiar modelo / parar.
- Llama **workflows** (subgrafos), no agentes directamente.

Esto mapea casi 1:1 a los primitivos de LangGraph:

| Tu diseño | Primitivo de LangGraph |
|---|---|
| Backlog, estado, memoria | `StateGraph` + `Annotation` (state schema) |
| Checkpoints | `checkpointer` (MemorySaver / PostgresSaver) |
| Presupuesto tokens/costo/tiempo | Campos custom en el state + un nodo `budget_guard` |
| Decidir continuar/reintentar/parar | Conditional edges (`addConditionalEdges`) |
| Llamar workflows, no agentes | Cada workflow es un **subgrafo** compilado, embebido como nodo del grafo principal |

---

## 2. Esquema de estado del Orchestrator

```ts
// src/orchestrator/state.ts
import { Annotation } from "@langchain/langgraph";

export const OrchestratorState = Annotation.Root({
  // Backlog y prioridades
  backlog: Annotation<Ticket[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
  currentTicket: Annotation<Ticket | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Memoria de decisiones (no el detalle de ejecución, eso vive en Knowledge Engine)
  decisionLog: Annotation<DecisionEntry[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Retries y estrategia
  retryCount: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxRetries: Annotation<number>({ reducer: (_, n) => n, default: () => 3 }),
  strategy: Annotation<"retry" | "partial_retry" | "change_context" | "change_model" | "rollback" | "abort" | "continue">({
    reducer: (_, n) => n,
    default: () => "continue",
  }),

  // Presupuestos — esto es lo que en LangGraph normalmente falta "de fábrica"
  tokenBudget: Annotation<{ limit: number; used: number }>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ limit: 200_000, used: 0 }),
  }),
  costBudget: Annotation<{ limitUsd: number; usedUsd: number }>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ limitUsd: 5, usedUsd: 0 }),
  }),
  deadline: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),

  // Config cargada en boot (ver sección 4)
  config: Annotation<OrchestratorConfig>({ reducer: (_, n) => n, default: () => null as any }),
});
```

> Nota de diseño: mantén el `state` delgado. LangGraph checkpointea (serializa) el estado después de cada nodo — si metes ahí logs completos de ejecución o el contexto que devuelve el Knowledge Engine, pagas ese costo en cada checkpoint. El Orchestrator solo debe guardar **decisiones y metadatos**, nunca evidencia completa (esa vive en el Knowledge Engine o en un Store aparte).

---

## 3. El grafo: nodos y edges condicionales

```ts
// src/orchestrator/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { OrchestratorState } from "./state";
import { planningWorkflow } from "../workflows/planning.subgraph";
import { implementationWorkflow } from "../workflows/implementation.subgraph";
import { recoveryWorkflow } from "../workflows/recovery.subgraph";
import { loadConfig } from "../config/loadConfig";

const builder = new StateGraph(OrchestratorState)
  .addNode("bootstrap", bootstrapNode)          // carga config .md/.yml
  .addNode("select_next_ticket", selectNextTicketNode)
  .addNode("budget_guard", budgetGuardNode)      // ¿queda presupuesto/tiempo?
  .addNode("planning", planningWorkflow)         // SUBGRAFO, no agente
  .addNode("implementation", implementationWorkflow) // SUBGRAFO
  .addNode("recovery", recoveryWorkflow)         // SUBGRAFO (diagnóstico->estrategia->fix)
  .addEdge("__start__", "bootstrap")
  .addEdge("bootstrap", "select_next_ticket")
  .addEdge("select_next_ticket", "budget_guard")
  .addConditionalEdges("budget_guard", routeAfterBudgetCheck, {
    continue: "planning",
    stop: END,
  })
  .addEdge("planning", "implementation")
  .addConditionalEdges("implementation", routeAfterImplementation, {
    pass: "select_next_ticket",   // siguiente ticket
    fail: "recovery",
  })
  .addConditionalEdges("recovery", routeAfterRecovery, {
    retry_implementation: "implementation",
    retry_planning: "planning",     // <- "cambiar de estrategia", no solo reintentar
    change_model: "implementation", // el nodo lee state.config.model actualizado
    abort: END,
  });

export const orchestrator = builder.compile({
  checkpointer: PostgresSaver.fromConnString(process.env.CHECKPOINT_DB_URL!),
});
```

La función `routeAfterRecovery` es donde vive literalmente la idea que describiste de "dejar de pensar en reintentar y empezar a pensar en cambiar de estrategia":

```ts
function routeAfterRecovery(state: typeof OrchestratorState.State) {
  if (state.strategy === "abort") return "abort";
  if (state.strategy === "change_model") return "change_model";
  if (state.strategy === "rollback" || state.strategy === "change_context") {
    // rollback == volver a un checkpoint anterior; LangGraph lo soporta nativo
    // via graph.updateState() + time travel sobre el checkpointer
    return "retry_planning";
  }
  if (state.retryCount >= state.maxRetries) return "abort";
  return "retry_implementation";
}
```

---

## 4. Configuración: providers de IA por `.env`/`.yml`

Esto resuelve tu requisito de "configurar cualquier proveedor (Anthropic, OpenAI, OpenRouter) mediante .env o .yml, con contratos estándar por agente/rol".

```yaml
# config/providers.yml
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
    baseUrl: https://api.anthropic.com
  openai:
    apiKeyEnv: OPENAI_API_KEY
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY
    baseUrl: https://openrouter.ai/api/v1

roles:
  orchestrator:
    provider: anthropic
    model: claude-sonnet-5
    maxTokens: 4096
  planner:
    provider: anthropic
    model: claude-opus-4-8
  implementer:
    provider: openrouter
    model: qwen/qwen3-coder
  recovery:
    provider: openai
    model: gpt-5.1
```

```ts
// src/config/loadConfig.ts
import fs from "node:fs";
import yaml from "js-yaml";
import "dotenv/config";

export interface RoleConfig { provider: string; model: string; maxTokens?: number }
export interface OrchestratorConfig {
  providers: Record<string, { apiKeyEnv: string; baseUrl?: string }>;
  roles: Record<string, RoleConfig>;
}

export function loadProvidersConfig(path = "config/providers.yml"): OrchestratorConfig {
  const raw = fs.readFileSync(path, "utf8");
  const cfg = yaml.load(raw) as OrchestratorConfig;
  // valida que cada apiKeyEnv referenciado exista en process.env
  for (const [name, p] of Object.entries(cfg.providers)) {
    if (!process.env[p.apiKeyEnv]) {
      throw new Error(`Falta la variable de entorno ${p.apiKeyEnv} para el provider "${name}"`);
    }
  }
  return cfg;
}

// Contrato estándar: cada rol se resuelve a un chat model de LangChain,
// sin importar el provider. Esto es lo que te da "cualquier proveedor,
// cualquier modelo, mismo contrato".
export function resolveModelForRole(role: string, cfg: OrchestratorConfig) {
  const roleCfg = cfg.roles[role];
  const providerCfg = cfg.providers[roleCfg.provider];
  switch (roleCfg.provider) {
    case "anthropic": {
      const { ChatAnthropic } = require("@langchain/anthropic");
      return new ChatAnthropic({ model: roleCfg.model, maxTokens: roleCfg.maxTokens });
    }
    case "openai":
    case "openrouter": {
      const { ChatOpenAI } = require("@langchain/openai");
      return new ChatOpenAI({
        model: roleCfg.model,
        configuration: providerCfg.baseUrl ? { baseURL: providerCfg.baseUrl } : undefined,
      });
    }
    default:
      throw new Error(`Provider desconocido: ${roleCfg.provider}`);
  }
}
```

---

## 5. Estructura de directorios óptima (reutilizable entre proyectos)

Aquí está el punto central de lo que pediste: dónde viven las **rules**, la **architecture** y la **governance** como archivos `.md`, de forma que el módulo sea configurable por proyecto sin tocar código.

El patrón que más funciona en producción hoy (Claude Code lo usa así, y los harnesses declarativos tipo AutoHarness hacen lo mismo pero en YAML) es la **carga por capas con precedencia**: reglas globales del módulo → reglas del proyecto → reglas locales/no versionadas. Cuanto más cerca del proyecto/directorio actual, mayor prioridad.

```
multiagent-harness/                     # el módulo/paquete reutilizable (npm package o repo template)
├── package.json
├── src/
│   ├── orchestrator/
│   │   ├── state.ts
│   │   ├── graph.ts
│   │   └── nodes/
│   ├── workflows/                      # subgrafos: planning, implementation, recovery
│   │   ├── planning.subgraph.ts
│   │   ├── implementation.subgraph.ts
│   │   └── recovery.subgraph.ts
│   ├── knowledge-engine/                # capa 2, servicio aparte
│   ├── config/
│   │   ├── loadConfig.ts               # carga providers.yml
│   │   └── loadContext.ts              # carga rules/architecture/governance .md (capa por capa)
│   └── quality-gate/
│
├── config/
│   ├── providers.yml                   # qué proveedor/modelo por rol (sección 4)
│   └── budgets.yml                     # límites por defecto de tokens/costo/tiempo
│
├── .harness/                           # <-- ESTA es la carpeta de configuración .md, versionada
│   ├── rules/
│   │   ├── 00-global.md                # reglas que aplican SIEMPRE, cualquier proyecto
│   │   ├── coding-style.md
│   │   ├── forbidden-zones.md          # directorios/archivos que el harness nunca toca
│   │   └── testing.md
│   ├── architecture/
│   │   ├── overview.md                 # descripción libre de la arquitectura del repo destino
│   │   ├── adr/                        # Architecture Decision Records, uno por archivo
│   │   │   ├── 0001-usar-hexagonal.md
│   │   │   └── 0002-event-driven-orders.md
│   │   └── patterns.md                 # patrones existentes que el Implementation Loop debe imitar
│   └── governance/
│       ├── approvals.md                # qué acciones son allow/deny/ask
│       ├── budgets.md                  # política de presupuesto en lenguaje natural (complementa budgets.yml)
│       ├── escalation.md               # cuándo escalar a humano
│       └── quality-gates.md            # criterios de "definition of done"
│
├── .harness.local/                     # NO versionado (.gitignore) — overrides por developer/máquina
│   └── rules/
│       └── local-overrides.md
│
└── projects/                           # si el módulo sirve a varios repos destino a la vez
    ├── project-a/
    │   └── .harness/                   # mismo esquema de arriba, pero específico de project-a
    └── project-b/
        └── .harness/
```

### Reglas de precedencia (idénticas al patrón CLAUDE.md)

1. `.harness/rules/00-global.md` del **módulo** (defaults del harness, aplican a cualquier repo destino).
2. `.harness/**` dentro del **repo del proyecto destino** (o `projects/<nombre>/.harness/`) — pisa lo global.
3. `.harness.local/**` — no versionado, override de la máquina/desarrollador actual, máxima prioridad, nunca se commitea.

```ts
// src/config/loadContext.ts
import fs from "node:fs";
import path from "node:path";

interface ContextLayer { source: "global" | "project" | "local"; file: string; content: string }

const LAYER_DIRS = [
  { source: "global" as const, dir: path.resolve(__dirname, "../../.harness") },
  { source: "project" as const, dir: path.resolve(process.cwd(), ".harness") },
  { source: "local" as const, dir: path.resolve(process.cwd(), ".harness.local") },
];

export function loadContextLayer(kind: "rules" | "architecture" | "governance"): ContextLayer[] {
  const layers: ContextLayer[] = [];
  for (const { source, dir } of LAYER_DIRS) {
    const target = path.join(dir, kind);
    if (!fs.existsSync(target)) continue;
    for (const file of fs.readdirSync(target)) {
      if (!file.endsWith(".md")) continue;
      layers.push({
        source,
        file: path.join(target, file),
        content: fs.readFileSync(path.join(target, file), "utf8"),
      });
    }
  }
  // orden de carga = orden de precedencia: lo más específico va al final,
  // así queda más cerca de la "atención" del modelo si concatenas
  return layers;
}

// Ensambla el bloque de contexto que se inyecta al nodo correspondiente
// (planner lee architecture+rules, quality-gate lee governance, etc.)
export function buildContextBlock(kind: "rules" | "architecture" | "governance"): string {
  return loadContextLayer(kind)
    .map((l) => `<!-- source:${l.source} file:${path.basename(l.file)} -->\n${l.content}`)
    .join("\n\n---\n\n");
}
```

### Ejemplo de contenido: `.harness/governance/approvals.md`

```markdown
# Approvals

## Allow (sin confirmación humana)
- Leer archivos del repo, ejecutar tests, lint, análisis estático.
- Crear parches en `src/**` y `tests/**`.

## Ask (requiere aprobación humana antes de aplicar)
- Cambios en `src/config/**`, `infra/**`, migraciones de base de datos.
- Cualquier cambio que borre más de 50 líneas en un solo archivo.

## Deny (el harness nunca lo hace, ni con aprobación)
- Modificar `.github/workflows/**` sin ticket explícito de infraestructura.
- Hacer `git push --force` a `main`.
- Instalar dependencias nuevas sin que el Quality Gate valide licencia y vulnerabilidades.
```

### Ejemplo: `.harness/rules/forbidden-zones.md`

```markdown
# Zonas prohibidas

El Implementation Loop NUNCA debe escribir en:

- `secrets/`
- `**/*.pem`, `**/*.key`
- `legacy/` (código congelado, solo lectura)

Si una tarea requiere tocar estas rutas, el Orchestrator debe escalar
directamente a `governance/escalation.md` sin pasar por Recovery.
```

Este esquema te da exactamente lo que pediste: el módulo es el mismo código Node/LangGraph para cualquier proyecto, y lo único que cambia entre integraciones es el contenido de `.harness/` — versionable, revisable en PR, y con precedencia clara entre lo global del harness y lo específico del repo destino.

---

## 6. Siguiente paso lógico

Con esto ya tienes el Orchestrator funcionando como state machine con presupuestos, retries y cambio de estrategia, más el sistema de configuración por capas en `.md`/`.yml`. Los siguientes how-to naturales, cuando quieras, son:

1. **Knowledge Engine (capa 2)** — cómo indexar el repo destino (CodeGraph + vector DB) para que "devuelva evidencia, no documentos".
2. **Implementation Loop (capa 4) + Validation Pipeline (capa 5)** — el subgrafo que realmente genera parches y los valida con compile/tests/lint/security.
3. **Recovery Loop (capa 6)** — el diagnóstico estructurado (Compilation/Architecture/Tests/Runtime/Dependencies/Formatting/Security) que alimenta `routeAfterRecovery`.

Dime cuál sigues y seguimos con el mismo nivel de detalle.
