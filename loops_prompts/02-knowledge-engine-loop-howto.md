# How-To: Knowledge Engine (Capa 2) como un loop, no como un prompt

## 0. Por qué "loop" y no "prompt" aquí

Tu propio diseño ya lo dice: el Knowledge Engine "no devuelve documentos, devuelve evidencia". Eso es exactamente la línea que separa el *context engineering* (armar un prompt con buen contexto una sola vez) del *loop engineering* (un ciclo que decide qué buscar, observa lo que encuentra, verifica si es suficiente, y solo entonces se detiene).

La literatura de loop engineering describe esta evolución en cuatro etapas, y es útil tenerla en la cabeza porque tu Knowledge Engine puede vivir en cualquiera de ellas — la diferencia de eficiencia es enorme:

| Etapa | Qué hace | Riesgo dominante |
|---|---|---|
| Prompt-centric | Un prompt bien escrito pide "dame el contexto de X" | Respuesta débil o engañosa si el contexto no estaba en el prompt |
| Context-centric | Se arma un contexto rico una sola vez (RAG clásico: embeber, buscar top-k, meter todo al prompt) | Sobrecarga de contexto, evidencia faltante o desactualizada |
| Harnessed | El agente tiene herramientas (grep, glob, vector search) pero las usa sin ciclo de verificación explícito | Uso de herramientas inseguro o no verificado |
| **Loop-engineered** | El sistema define un objetivo acotado, decide qué recuperar, observa, **verifica si la evidencia alcanza**, y repite/expande/reduce hasta cumplir criterio o escalar | Este es el que minimiza deriva de contexto y costo |

Si construyes el Knowledge Engine como "un RAG con top-k=5 y ya" (etapa 2), estás dejando eficiencia y precisión sobre la mesa. La evidencia de 2026 lo confirma en la práctica: Claude Code, Cursor, Devin y Sourcegraph Amp convergieron en 2026 hacia **agent-as-retriever** (el agente decide iterativamente qué buscar y cómo) en vez de vector-search puro, y un estudio de 2026 sobre grafos de conocimiento de código vía Tree-sitter + MCP reportó reducciones de ~10x en tokens y 2.1x en tool calls frente al patrón "preguntar al modelo, grepear el repo, leer archivos" sin loop.

Así que la Capa 2 no es un endpoint de búsqueda. Es un **loop LEAF** (Loop Engineering Architecture Framework) embebido como subgrafo del Orchestrator.

---

## 1. El Knowledge Engine mapeado a los 9 componentes de LEAF

| Componente LEAF | En tu Knowledge Engine |
|---|---|
| **Goal & policy** | "Dado este ticket, reunir la evidencia mínima suficiente para Planning e Implementation — nunca más." Política: máx. N iteraciones, máx. tokens de evidencia devuelta. |
| **Trigger** | Llamado por el Orchestrator (nodo `knowledge_engine`) antes de Planning, y otra vez por Implementation Loop si necesita más contexto. |
| **Context manager** | Decide qué índice consultar primero: CLAUDE.md/.harness (siempre), luego CodeGraph estructural, luego vector semántico, luego grep/glob puntual. |
| **Agent planner + harness** | Un modelo barato/rápido (rol `retriever` en tu `providers.yml`) que decide la *siguiente* acción de búsqueda, no todas de una vez. |
| **Tool & action layer** | Ejecuta: `grep`, `ast_query` (Tree-sitter), `vector_search` (Chroma/pgvector), `graph_traverse` (Neo4j/NetworkX). |
| **Observation** | Resultado crudo de cada herramienta: rutas de archivo, snippets, nodos del grafo, distancias de similitud. |
| **Verification** | Un segundo modelo (o el mismo con otro prompt, pero idealmente otro rol) que evalúa: ¿esta evidencia responde el ticket? ¿falta algo obvio (tests relacionados, ADR, dependencias)? Principio de **independencia del verificador**: quien verifica no es quien recuperó. |
| **Memory & state store** | Qué se buscó, qué se descartó por irrelevante, qué evidencia quedó confirmada — para no repetir búsquedas en reintentos del Recovery Loop. |
| **Governance** | Presupuesto de iteraciones/tokens propio (más chico que el del Orchestrator), y escalación si tras N vueltas no hay evidencia suficiente (en vez de alucinar una respuesta). |

---

## 2. Patrón elegido: Explore–Narrow, con recuperación híbrida de 3 niveles

Tu ticket de ejemplo (`Agregar CompanyService` → `CompanyController.java`, `CompanyRepository.java`, `BaseService.java`, reglas, ejemplos similares) es exactamente el caso de uso del patrón **explore–narrow**: al inicio no sabes con certeza qué archivos son relevantes, así que exploras con búsquedas amplias y vas *narrowing* (acotando) según lo que vas confirmando — en vez de comprometerte a un solo `top_k` fijo desde el principio.

La forma más eficiente de ejecutar cada paso de "explore" es una pila de **3 niveles**, del más barato/preciso al más caro/difuso (así es como lo hacen en producción Cline, Cursor y los MCP de code-graph):

1. **Nivel estructural (barato, exacto)** — Tree-sitter/AST: "¿qué implementa `BaseService`?", "¿quién llama a `CompanyRepository.save`?". Sin LLM de por medio, es una consulta a un grafo.
2. **Nivel léxico (barato, exacto)** — `ripgrep`/glob: nombres de archivo, strings literales, imports. Progressive disclosure: solo cargas el archivo completo si el match lo amerita.
3. **Nivel semántico (más caro, difuso)** — vector search sobre embeddings de chunks (Chroma/pgvector): útil cuando el ticket usa lenguaje natural que no calza literalmente con nombres de símbolos ("agregar soporte de facturación recurrente" no menciona ninguna clase).

El planner del loop decide **en qué orden y cuántas veces** usar cada nivel — eso es lo que lo hace un loop y no un pipeline fijo.

---

## 3. El loop en LangGraph.js (subgrafo del Orchestrator)

### 3.1 Estado del subgrafo

```ts
// src/workflows/knowledge-engine/state.ts
import { Annotation } from "@langchain/langgraph";

export const KnowledgeState = Annotation.Root({
  ticket: Annotation<Ticket>({ reducer: (_, n) => n, default: () => null as any }),

  // Qué se ha intentado y qué se descartó — evita repetir búsquedas
  triedQueries: Annotation<string[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  discardedEvidence: Annotation<EvidenceItem[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Evidencia confirmada (esto es lo único que sale del loop)
  confirmedEvidence: Annotation<EvidenceItem[]>({
    reducer: (prev, next) => dedupeById(prev.concat(next)),
    default: () => [],
  }),

  // Control del loop (explore-narrow)
  iteration: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxIterations: Annotation<number>({ reducer: (_, n) => n, default: () => 5 }),
  nextAction: Annotation<RetrievalAction | null>({ reducer: (_, n) => n, default: () => null }),
  sufficiency: Annotation<"insufficient" | "sufficient" | "escalate">({
    reducer: (_, n) => n,
    default: () => "insufficient",
  }),
});

interface EvidenceItem {
  id: string;                // path#symbol o path#lineRange
  source: "ast" | "grep" | "vector" | "adr" | "rule";
  content: string;
  relevanceNote: string;     // por qué el verificador la aceptó
}

interface RetrievalAction {
  tier: "ast" | "grep" | "vector";
  query: string;
}
```

> Nota: igual que en el Orchestrator, `confirmedEvidence` guarda snippets acotados, no archivos completos. El objetivo del Knowledge Engine es literalmente reducir tokens, así que cada `EvidenceItem` debería tener un tamaño máximo (p. ej. 40 líneas) — si el consumidor (Planner) necesita más, que lo pida explícitamente vía `graph_traverse` en una siguiente iteración.

### 3.2 El grafo

```ts
// src/workflows/knowledge-engine/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { KnowledgeState } from "./state";

const builder = new StateGraph(KnowledgeState)
  .addNode("load_static_context", loadStaticContextNode)   // .harness/rules + architecture + ADRs, SIEMPRE primero
  .addNode("plan_retrieval", planRetrievalNode)             // decide la SIGUIENTE acción (no todas)
  .addNode("execute_retrieval", executeRetrievalNode)       // llama ast_query / grep / vector_search
  .addNode("verify_evidence", verifyEvidenceNode)           // verificador independiente
  .addNode("assemble_package", assemblePackageNode)         // solo si sufficiency === "sufficient"
  .addNode("escalate", escalateNode)                        // solo si sufficiency === "escalate"

  .addEdge("__start__", "load_static_context")
  .addEdge("load_static_context", "plan_retrieval")
  .addEdge("plan_retrieval", "execute_retrieval")
  .addEdge("execute_retrieval", "verify_evidence")
  .addConditionalEdges("verify_evidence", routeAfterVerification, {
    narrow: "plan_retrieval",   // seguir explorando con una consulta más específica
    sufficient: "assemble_package",
    escalate: "escalate",
  })
  .addEdge("assemble_package", END)
  .addEdge("escalate", END);

export const knowledgeEngineWorkflow = builder.compile();
```

```ts
function routeAfterVerification(state: typeof KnowledgeState.State) {
  if (state.sufficiency === "sufficient") return "sufficient";
  if (state.iteration >= state.maxIterations) return "escalate"; // gobernanza: no reintentar infinito
  return "narrow";
}
```

### 3.3 El planner del loop (decide UNA acción, no un plan completo)

Este es el nodo donde realmente se aplica loop engineering en vez de prompt engineering: en lugar de pedirle al modelo "dame todo el contexto relevante para este ticket" en una sola pasada, le pides "dado lo que ya sabemos y lo que ya descartamos, ¿cuál es la ÚNICA siguiente búsqueda más útil?".

```ts
// src/workflows/knowledge-engine/nodes/planRetrieval.ts
import { resolveModelForRole } from "../../../config/loadConfig";

export async function planRetrievalNode(state: typeof KnowledgeState.State) {
  const model = resolveModelForRole("retriever", state.config); // modelo barato/rápido
  const response = await model.invoke([
    { role: "system", content: RETRIEVER_PLANNER_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        ticket: state.ticket,
        alreadyTried: state.triedQueries,
        discarded: state.discardedEvidence.map((e) => e.id),
        confirmedSoFar: state.confirmedEvidence.map((e) => e.id),
      }),
    },
  ]);

  const action = parseRetrievalAction(response.content); // { tier, query }
  return {
    nextAction: action,
    triedQueries: [action.query],
    iteration: state.iteration + 1,
  };
}

const RETRIEVER_PLANNER_PROMPT = `
Eres el planner de búsqueda del Knowledge Engine. Tu única salida es UNA acción
de recuperación: { tier: "ast" | "grep" | "vector", query: string }.

Reglas:
- Prefiere "ast" cuando la pregunta es sobre relaciones de código (implementa,
  llama a, extiende, referencia).
- Prefiere "grep" cuando buscas un nombre exacto, un string literal o un archivo.
- Usa "vector" solo cuando el ticket usa lenguaje natural sin términos exactos
  del código.
- Nunca repitas una query ya intentada (ver "alreadyTried").
- Si ya hay evidencia confirmada suficiente para cubrir el ticket, no propongas
  más acciones — eso lo decide el verificador, no tú.
`;
```

### 3.4 El verificador (independiente del planner — principio de independencia del verificador)

```ts
// src/workflows/knowledge-engine/nodes/verifyEvidence.ts
export async function verifyEvidenceNode(state: typeof KnowledgeState.State) {
  const verifierModel = resolveModelForRole("kb_verifier", state.config); // OTRO rol/modelo
  const lastObservation = state.confirmedEvidence.slice(-1)[0];

  const response = await verifierModel.invoke([
    { role: "system", content: VERIFIER_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        ticket: state.ticket,
        confirmedEvidence: state.confirmedEvidence,
        lastObservation,
      }),
    },
  ]);

  const verdict = parseVerdict(response.content); // "insufficient" | "sufficient" | "escalate"
  return { sufficiency: verdict };
}

const VERIFIER_PROMPT = `
Eres el verificador del Knowledge Engine, independiente del planner que buscó
la evidencia. No confíes en que "se buscó algo" como señal de éxito.

Evalúa contra el ticket:
- ¿La evidencia confirmada cubre entidades, dependencias y reglas necesarias?
- ¿Falta algo evidente (tests relacionados, un ADR que restrinja el enfoque,
  un patrón existente que deba imitarse)?

Responde "sufficient" solo si un Planner (capa 3) podría trabajar SOLO con
esta evidencia, sin adivinar nada. Responde "escalate" si tras varias vueltas
la evidencia sigue sin aparecer (posible ticket mal definido o repo no indexado
correctamente) — no sigas intentando indefinidamente.
`;
```

Esto es el patrón **maker–checker** aplicado dentro del propio Knowledge Engine: el planner "hace" (propone y ejecuta búsquedas), el verificador "chequea" con criterio independiente. Evita el problema típico de que el mismo modelo que buscó se autoconvenza de que ya buscó suficiente.

---

## 4. Índices: qué construir antes de que el loop pueda correr

El loop de arriba asume que ya existen tres índices. Construirlos es trabajo de *indexing*, separado del loop de *retrieval* (no los mezcles: indexar es batch/offline, recuperar es el loop en caliente):

```ts
// src/knowledge-engine/indexing/buildIndexes.ts
// Se corre como job aparte (CLI o hook post-merge), NO dentro del loop de retrieval.

export async function buildStructuralIndex(repoPath: string) {
  // Tree-sitter parsea cada archivo -> nodos (clase, método, función) y aristas
  // (implementa, llama, extiende, importa). Se persiste en SQLite embebido o
  // Neo4j si el repo es grande. Este es tu "CodeGraph".
}

export async function buildVectorIndex(repoPath: string) {
  // Chunking consciente de AST (no cortar a medio método), embeddings con un
  // modelo de embeddings de código, y Merkle-tree o hash por archivo para
  // reindexar solo lo que cambió — no todo el repo en cada commit.
}

export async function loadStaticContext() {
  // .harness/rules, .harness/architecture (incluye ADRs), CLAUDE.md del repo
  // destino. Esto NO se busca con AI: se carga completo porque es pequeño y
  // estable — es exactamente el mismo patrón "progressive disclosure" de
  // Claude Code (CLAUDE.md se carga al inicio de sesión, todo lo demás es
  // just-in-time).
}
```

Config nueva para esto:

```yaml
# config/knowledge-engine.yml
indexing:
  structural:
    parser: tree-sitter
    storage: sqlite      # o "neo4j" si el repo supera cierto tamaño
    reindexOn: git-push  # hook, no en cada ticket
  vector:
    embeddingModel: nomic-embed-text-v1.5
    store: chroma        # o pgvector si ya tienes Postgres
    chunking: ast-aware
    maxChunkLines: 60
retrieval:
  maxIterations: 5
  maxEvidenceItems: 12
  maxLinesPerItem: 40
roles:
  retriever:
    provider: anthropic
    model: claude-haiku-4-5-20251001   # barato: solo decide UNA acción por vuelta
  kb_verifier:
    provider: anthropic
    model: claude-sonnet-5             # más capaz: juicio de suficiencia
```

---

## 5. Integración con el Orchestrator

En el grafo principal (`src/orchestrator/graph.ts` de la guía anterior), el nodo `knowledge_engine` ya no es un placeholder: es el subgrafo compilado de arriba, insertado antes de `planning`:

```ts
.addNode("knowledge_engine", knowledgeEngineWorkflow)
.addEdge("select_next_ticket", "knowledge_engine")
.addEdge("knowledge_engine", "budget_guard")
```

Y el Recovery Loop (capa 6, cuando la construyamos) podrá volver a llamar a este mismo subgrafo con `triedQueries` y `discardedEvidence` ya poblados — así no repite búsquedas que ya sabía que no servían, cumpliendo el principio LEAF de memoria/estado durable entre reintentos.

---

## 6. Gobernanza propia de este loop

Añade a `.harness/governance/`:

```markdown
<!-- .harness/governance/knowledge-engine.md -->
# Gobernanza del Knowledge Engine

- Máximo 5 iteraciones de explore-narrow por ticket. Al llegar al límite sin
  evidencia suficiente: escalar al humano con el registro de `triedQueries` y
  `discardedEvidence`, nunca inventar contexto.
- El verificador (`kb_verifier`) es un rol distinto al planner (`retriever`).
  Nunca deben resolver al mismo modelo/instancia en la misma corrida.
- La evidencia confirmada no debe exceder 12 items ni 40 líneas por item.
  Si Planning necesita más detalle de un item específico, lo pide en una
  iteración siguiente — no se sube el límite global.
```

---

## 7. Siguiente paso lógico

Con el Knowledge Engine funcionando como loop explore-narrow con verificador independiente, el siguiente natural es la **Capa 3 — Planner**, que consume exactamente el `confirmedEvidence` que este loop produce, y que internamente es también un loop LEAF (Discovery → Planning → Validation) con su propio patrón — probablemente **plan–execute–verify**, ya que ahí sí hay pasos ordenados y dependientes en vez de incertidumbre sobre qué buscar.

Dime si seguimos con esa o con el Implementation Loop.
