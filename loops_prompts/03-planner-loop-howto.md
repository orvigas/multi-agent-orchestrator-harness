# How-To: Planner (Capa 3) — Discovery → Planning → Validation como un plan–execute–verify loop

## 0. Encaje con tu diseño y patrón elegido

Tu propio diagrama ya es, sin que lo hayas nombrado así, un **plan–execute–verify loop**:

```
Discovery  → Planning → Validation
                ▲            │
                └── si rompe regla ──┘
```

Este es exactamente el patrón que la literatura de loop engineering recomienda para "tareas con múltiples pasos ordenados donde errores tempranos se propagan" — que es tu caso: si Discovery se equivoca sobre los riesgos, Planning construye sobre una base falsa, y solo Validation lo detecta.

Mapeo directo:

| Tu capa | Rol en plan–execute–verify |
|---|---|
| **Discovery** | Genera el "plan provisional" de entendimiento — no del código, del problema (problemas, dependencias, riesgos) |
| **Planning** | El "execute" del loop macro: produce Plan, Tasks, Orden, Dependencias a partir de ese entendimiento |
| **Validation** | El "verify": ¿el plan rompe alguna regla de arquitectura/gobernanza? Si sí, vuelve a Planning — **no a Discovery**, salvo un caso especial (ver §3) |

El riesgo principal de este patrón, documentado en la literatura, es la **fijación de plan** (*plan fixation*): el sistema sigue regenerando Planning con el mismo Discovery erróneo de base, sin darse cuenta de que el problema real está un nivel más arriba. Por eso el Planner necesita, además del ciclo básico, una regla explícita de cuándo "cambiar de estrategia" en vez de solo reintentar — esto conecta directamente con la idea que tú mismo escribiste al final de tu documento original.

---

## 1. Estado del subgrafo

```ts
// src/workflows/planner/state.ts
import { Annotation } from "@langchain/langgraph";

export const PlannerState = Annotation.Root({
  ticket: Annotation<Ticket>({ reducer: (_, n) => n, default: () => null as any }),
  evidence: Annotation<EvidenceItem[]>({ reducer: (_, n) => n, default: () => [] }), // viene del Knowledge Engine

  // Salida de Discovery
  discovery: Annotation<DiscoveryResult | null>({ reducer: (_, n) => n, default: () => null }),

  // Salida de Planning
  plan: Annotation<Plan | null>({ reducer: (_, n) => n, default: () => null }),
  planRevisions: Annotation<PlanRevision[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Salida de Validation
  validationIssues: Annotation<ValidationIssue[]>({ reducer: (_, n) => n, default: () => [] }),
  validationVerdict: Annotation<"valid" | "invalid" | "escalate">({
    reducer: (_, n) => n,
    default: () => "invalid",
  }),

  // Control del loop macro y detección de plan fixation
  planningIteration: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxPlanningIterations: Annotation<number>({ reducer: (_, n) => n, default: () => 4 }),
  strategy: Annotation<"revise_plan" | "revisit_discovery" | "escalate" | "proceed">({
    reducer: (_, n) => n,
    default: () => "proceed",
  }),
});

interface DiscoveryResult {
  problems: string[];
  dependencies: string[];
  risks: { description: string; severity: "low" | "medium" | "high" }[];
}

interface Plan {
  tasks: { id: string; description: string; touchesFiles: string[] }[];
  order: string[];        // ids en orden de ejecución
  dependencies: Record<string, string[]>; // taskId -> [taskIds de los que depende]
}

interface PlanRevision {
  iteration: number;
  plan: Plan;
  rejectedBy?: ValidationIssue[];
}

interface ValidationIssue {
  rule: string;           // qué regla de .harness/ se violó
  detail: string;
  rootCause: "plan_error" | "discovery_gap"; // <- esta distinción es la clave anti-fijación
}
```

El campo que no existe en un plan–execute–verify "de libro" es `ValidationIssue.rootCause`. Ese campo es lo que le permite al loop distinguir "el plan está mal hecho" (reintentar Planning) de "el entendimiento del problema estaba mal" (volver a Discovery) — la diferencia que pediste al final de tu diseño original.

---

## 2. El grafo

```ts
// src/workflows/planner/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { PlannerState } from "./state";

const builder = new StateGraph(PlannerState)
  .addNode("discovery", discoveryNode)
  .addNode("planning", planningNode)
  .addNode("validate_plan", validatePlanNode)
  .addNode("escalate", escalateNode)

  .addEdge("__start__", "discovery")
  .addEdge("discovery", "planning")
  .addEdge("planning", "validate_plan")
  .addConditionalEdges("validate_plan", routeAfterValidation, {
    proceed: END,                 // plan válido -> Orchestrator sigue a Implementation
    revise_plan: "planning",      // el plan está mal, el entendimiento no
    revisit_discovery: "discovery", // el entendimiento está mal -> cambio de estrategia real
    escalate: "escalate",
  })
  .addEdge("escalate", END);

export const plannerWorkflow = builder.compile();
```

```ts
function routeAfterValidation(state: typeof PlannerState.State) {
  if (state.validationVerdict === "valid") return "proceed";

  if (state.planningIteration >= state.maxPlanningIterations) {
    return "escalate"; // gobernanza: nunca reintentar indefinido
  }

  // Anti-fijación: si la mayoría de issues de esta vuelta apuntan a un gap
  // de entendimiento (no a un error de construcción del plan), no tiene
  // sentido regenerar Planning otra vez con el mismo Discovery.
  const discoveryGapRatio =
    state.validationIssues.filter((i) => i.rootCause === "discovery_gap").length /
    Math.max(state.validationIssues.length, 1);

  if (discoveryGapRatio > 0.5) return "revisit_discovery";
  return "revise_plan";
}
```

Este `routeAfterValidation` es literalmente el "cambio dinámico de estrategia" que describiste: en vez de asumir siempre "reintentar Planning", el loop pregunta primero si el problema viene de una etapa anterior.

---

## 3. Discovery: explore–narrow acotado, no desde cero

Discovery no vuelve a hacer el trabajo del Knowledge Engine — parte de `evidence` (el `confirmedEvidence` de la Capa 2) y razona sobre riesgos y dependencias que la evidencia por sí sola no hace explícitos. Es una pasada de análisis, no una nueva ronda de búsqueda; si detecta que falta evidencia, esa es la señal para que el Orchestrator vuelva a invocar el Knowledge Engine (no algo que Discovery resuelva por sí mismo).

```ts
// src/workflows/planner/nodes/discovery.ts
import { resolveModelForRole } from "../../../config/loadConfig";
import { buildContextBlock } from "../../../config/loadContext";

export async function discoveryNode(state: typeof PlannerState.State) {
  const model = resolveModelForRole("discovery", state.config);
  const architectureContext = buildContextBlock("architecture"); // ADRs, patterns.md

  const response = await model.invoke([
    { role: "system", content: DISCOVERY_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        ticket: state.ticket,
        evidence: state.evidence,
        architectureContext,
        previousDiscovery: state.discovery, // si venimos de un revisit_discovery
        previousValidationIssues: state.validationIssues.filter(
          (i) => i.rootCause === "discovery_gap"
        ),
      }),
    },
  ]);

  return { discovery: parseDiscoveryResult(response.content) };
}

const DISCOVERY_PROMPT = `
Analiza el ticket usando SOLO la evidencia entregada (no inventes archivos
o clases que no aparezcan ahí). Produce:
- problems: qué exactamente pide el ticket, en términos concretos del repo
- dependencies: qué otras piezas del sistema se ven afectadas
- risks: qué podría salir mal, con severidad (low/medium/high)

Si "previousValidationIssues" no está vacío, significa que un plan anterior
falló por un problema de ENTENDIMIENTO, no de construcción del plan. Corrige
específicamente esos gaps, no repitas el mismo análisis.

Si la evidencia es insuficiente para responder con confianza, decláralo
explícitamente en "risks" con severidad "high" y describe qué falta — el
Orchestrator decidirá si vuelve al Knowledge Engine.
`;
```

---

## 4. Planning: genera Plan, Tasks, Orden, Dependencias

```ts
// src/workflows/planner/nodes/planning.ts
export async function planningNode(state: typeof PlannerState.State) {
  const model = resolveModelForRole("planner", state.config);
  const rejectedIssues = state.validationIssues.filter((i) => i.rootCause === "plan_error");

  const response = await model.invoke([
    { role: "system", content: PLANNING_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        ticket: state.ticket,
        discovery: state.discovery,
        lastPlan: state.plan,
        rejectedIssues, // feedback específico de por qué falló la vuelta anterior
      }),
    },
  ]);

  const plan = parsePlan(response.content);
  return {
    plan,
    planningIteration: state.planningIteration + 1,
    planRevisions: [{ iteration: state.planningIteration + 1, plan, rejectedBy: rejectedIssues }],
  };
}

const PLANNING_PROMPT = `
Genera un plan de tasks a partir de discovery.problems, discovery.dependencies
y discovery.risks. Cada task debe listar los archivos que probablemente toca
(touchesFiles) y sus dependencias de orden.

Nunca produzcas una task que contradiga un risk de severidad "high" sin
mitigarlo explícitamente en otra task previa.

Si "rejectedIssues" no está vacío, son razones concretas por las que la
versión anterior del plan fue rechazada por Validation — corrígelas
puntualmente, no regeneres el plan desde cero salvo que sea inevitable.
`;
```

---

## 5. Validation: ¿el plan rompe alguna regla?

Este nodo nunca modifica el plan — solo lo evalúa contra `.harness/architecture` y `.harness/governance`, exactamente como en tu diseño ("nunca toca código"). Aplica el mismo principio de **independencia del verificador** que usamos en el Knowledge Engine: idealmente un rol/modelo distinto al de `planner`.

```ts
// src/workflows/planner/nodes/validatePlan.ts
export async function validatePlanNode(state: typeof PlannerState.State) {
  const model = resolveModelForRole("plan_validator", state.config);
  const rules = buildContextBlock("rules");
  const governance = buildContextBlock("governance");
  const architecture = buildContextBlock("architecture");

  const response = await model.invoke([
    { role: "system", content: VALIDATION_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        plan: state.plan,
        discovery: state.discovery,
        rules,
        governance,
        architecture,
      }),
    },
  ]);

  const { verdict, issues } = parseValidationResult(response.content);
  return { validationVerdict: verdict, validationIssues: issues };
}

const VALIDATION_PROMPT = `
Eres el validador del plan, independiente de quien lo construyó. Evalúa el
plan contra las reglas, gobernanza y arquitectura entregadas. No confíes en
que el plan "suena razonable" — verifica cada task contra restricciones
explícitas (forbidden-zones, approvals, patrones existentes, ADRs).

Para cada problema encontrado, clasifica su causa raíz:
- "plan_error": el plan malinterpretó o ignoró algo que discovery SÍ tenía
  correctamente identificado.
- "discovery_gap": el problema viene de que discovery no identificó una
  dependencia, riesgo o restricción arquitectónica relevante.

Responde "valid" solo si ninguna task viola una regla dura (deny). Responde
"escalate" si la ambigüedad de las reglas mismas impide un veredicto claro
(por ejemplo, dos ADRs que se contradicen).
`;
```

---

## 6. Config: nuevos roles

```yaml
# config/planner.yml
roles:
  discovery:
    provider: anthropic
    model: claude-sonnet-5
  planner:
    provider: anthropic
    model: claude-opus-4-8       # el paso que más se beneficia de razonamiento fuerte
  plan_validator:
    provider: openai              # deliberadamente OTRO proveedor, no solo otro rol
    model: gpt-5.1

planning:
  maxIterations: 4                # tope de revise_plan + revisit_discovery combinados
  discoveryGapThreshold: 0.5      # % de issues "discovery_gap" que dispara revisit_discovery
```

Usar un **proveedor distinto** para `plan_validator` (no solo un modelo distinto del mismo proveedor) es una capa extra de independencia del verificador: reduce la probabilidad de que un sesgo sistemático del mismo proveedor pase desapercibido en ambos lados del maker–checker.

---

## 7. Integración con el Orchestrator

En `src/orchestrator/graph.ts`, el nodo `planning` deja de ser un placeholder — es este subgrafo:

```ts
.addNode("planning", plannerWorkflow)  // reemplaza el placeholder de la guía 1
```

Y el `routeAfterRecovery` que ya definimos en la Capa 1 (`retry_planning: "planning"`) ahora invoca este subgrafo completo de nuevo — que a su vez, gracias al campo `strategy`/`rootCause`, decide internamente si reintentar Planning o volver hasta Discovery. Es decir: el "cambio dinámico de estrategia" ocurre en dos niveles anidados —

- **Dentro del Planner**: Validation decide entre `revise_plan` y `revisit_discovery`.
- **Entre capas** (ya cubierto en la Capa 1): Recovery decide entre `retry_implementation`, `retry_planning` y `change_model`.

---

## 8. Gobernanza propia

```markdown
<!-- .harness/governance/planner.md -->
# Gobernanza del Planner

- Máximo 4 iteraciones combinadas (revise_plan + revisit_discovery) por
  ticket. Al llegar al límite: escalar con el historial completo de
  `planRevisions` y `validationIssues` — nunca forzar un plan que Validation
  ya rechazó dos veces por la misma regla.
- `plan_validator` debe resolver a un proveedor de IA distinto al de
  `planner` (ver config/planner.yml). Nunca deben compartir proveedor.
- Si >50% de los issues de una vuelta son "discovery_gap", es obligatorio
  volver a Discovery, no seguir regenerando el plan (previene plan fixation).
- Validation nunca modifica el plan directamente. Su única salida es
  verdict + issues clasificados por rootCause.
```

---

## 9. Siguiente paso lógico

Con Discovery/Planning/Validation funcionando como un plan–execute–verify loop con anti-fijación incorporada, el plan validado (`state.plan`) es exactamente lo que consume la **Capa 4 — Implementation Loop**: cada `task` del plan se convierte en una invocación del loop que produce un patch, seguida de la **Capa 5 — Validation Pipeline** (compile → tests → lint → static → security → performance) que ya no es una IA evaluando reglas de arquitectura, sino herramientas reales generando evidencia objetiva.

Dime si seguimos con esa combinación (Implementation Loop + Validation Pipeline) o con el Recovery Loop primero.
