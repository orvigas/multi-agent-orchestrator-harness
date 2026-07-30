# How-To: Recovery Loop (Capa 6) — Diagnóstico → Estrategia → Fix

## 0. Dónde encaja esto y por qué aquí SÍ hay opinión

En la Capa 5 dijimos explícitamente: nada de LLM en el camino crítico, solo evidencia objetiva. Aquí es al revés — el Recovery Loop es precisamente la capa donde esa evidencia se **interpreta**. La literatura de loop engineering describe esto como una "escalera de verificación" de 5 niveles:

| Nivel | Tipo de check | Dónde vive en tu arquitectura |
|---|---|---|
| 1 — Determinístico (exit code, assertion) | Compile, tests, exit codes | Capa 5 |
| 2 — Regla/constraint sobre texto | Lint, static analysis | Capa 5 |
| 3 — Verdad de campo demorada | Tests de integración, deploy real | Capa 5 (parcial) |
| **4 — Modelo como juez** | Diagnóstico de causa raíz, decisión de estrategia | **Capa 6 (aquí)** |
| 5 — Checkpoint humano | Aprobación, escalación | Capa 6 → humano |

El punto de disciplina que marca la literatura: **nunca disfrazar el nivel 4 como si fuera nivel 1**. El diagnóstico del Recovery Loop es una opinión informada por evidencia objetiva, no un hecho — por eso nunca debe re-decidir directamente si algo "pasó" o "falló" (eso ya lo decidió la Capa 5), solo por qué falló y qué hacer al respecto.

---

## 1. Los tres sub-pasos, mapeados a lo que ya construimos

```
Diagnóstico          →  Estrategia         →  Fix
(¿qué falló y         (retry / partial      (task acotada de
 por qué?)             retry / cambiar       vuelta al
                       contexto / cambiar    Implementation
                       modelo / rollback /   Loop — NUNCA
                       abort)                regenerar todo)
```

- **Diagnóstico** consume el `failureCategory` objetivo de la Capa 5 (Compilation/Tests/Formatting/Security/StaticAnalysis/Performance) y lo profundiza a una taxonomía de causa raíz más rica — la que ya usa tu diseño original: **Compilation, Architecture, Tests, Runtime, Dependencies, Formatting, Security**. La diferencia importa: un fallo de `compile` (Capa 5) puede tener como causa raíz `Architecture` (la task intentó saltarse una frontera hexagonal) en vez de simplemente `Compilation`.
- **Estrategia** es la decisión que ya modelamos como el campo `strategy` en el estado del Orchestrator (Capa 1): `retry | partial_retry | change_context | change_model | rollback | abort`.
- **Fix** nunca regenera todo el patch — construye una task acotada ("corrige específicamente X") que se le devuelve al Implementation Loop (Capa 4), reutilizando su propio mecanismo de `previousQuickCheckFeedback` que ya dejamos preparado ahí.

---

## 2. Estado del subgrafo

```ts
// src/workflows/recovery/state.ts
import { Annotation } from "@langchain/langgraph";

export const RecoveryState = Annotation.Root({
  // Entrada: lo que ya sabemos de capas anteriores
  failureCategory: Annotation<FailureCategory>({ reducer: (_, n) => n, default: () => "Tests" }),
  validationEvidence: Annotation<StageResult[]>({ reducer: (_, n) => n, default: () => [] }),
  patchAttempts: Annotation<PatchAttempt[]>({ reducer: (_, n) => n, default: () => [] }),
  recoveryHistory: Annotation<RecoveryEntry[]>({   // memoria a través de MÚLTIPLES pasadas por Recovery
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Salida de Diagnóstico
  diagnosis: Annotation<Diagnosis | null>({ reducer: (_, n) => n, default: () => null }),

  // Salida de Estrategia
  strategy: Annotation<Strategy>({ reducer: (_, n) => n, default: () => "retry" }),
  targetedFixTask: Annotation<PlanTask | null>({ reducer: (_, n) => n, default: () => null }),

  recoveryIteration: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxRecoveryIterations: Annotation<number>({ reducer: (_, n) => n, default: () => 3 }),
});

type RootCauseCategory =
  | "Compilation" | "Architecture" | "Tests" | "Runtime"
  | "Dependencies" | "Formatting" | "Security";

interface Diagnosis {
  rootCause: RootCauseCategory;
  detail: string;
  confidence: "low" | "medium" | "high";
  isRepeatedFailure: boolean;   // ¿ya vimos este MISMO rootCause+detail antes en recoveryHistory?
}

type Strategy = "retry" | "partial_retry" | "change_context" | "change_model" | "rollback" | "abort";

interface RecoveryEntry {
  iteration: number;
  diagnosis: Diagnosis;
  strategyChosen: Strategy;
  outcome?: "resolved" | "still_failing"; // se completa en la siguiente pasada
}
```

El campo `isRepeatedFailure` es la pieza que evita el patrón de "reintentar exactamente lo mismo" que la literatura marca como el riesgo #1 de un recovery mal diseñado: **repetir una estrategia fallida porque el sistema no recuerda correctamente qué ya intentó**. Por eso `recoveryHistory` es memoria acumulada **entre pasadas** de este subgrafo — no se resetea cuando el Orchestrator vuelve a llamar a Recovery.

---

## 3. El grafo

```ts
// src/workflows/recovery/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { RecoveryState } from "./state";

const builder = new StateGraph(RecoveryState)
  .addNode("diagnose", diagnoseNode)
  .addNode("decide_strategy", decideStrategyNode)
  .addNode("prepare_fix", prepareFixNode)
  .addNode("prepare_rollback", prepareRollbackNode)
  .addNode("prepare_escalation", prepareEscalationNode)

  .addEdge("__start__", "diagnose")
  .addEdge("diagnose", "decide_strategy")
  .addConditionalEdges("decide_strategy", routeStrategy, {
    fix: "prepare_fix",           // retry, partial_retry, change_context, change_model
    rollback: "prepare_rollback",
    abort: "prepare_escalation",
  })
  .addEdge("prepare_fix", END)
  .addEdge("prepare_rollback", END)
  .addEdge("prepare_escalation", END);

export const recoveryWorkflow = builder.compile();
```

```ts
function routeStrategy(state: typeof RecoveryState.State) {
  if (state.strategy === "rollback") return "rollback";
  if (state.strategy === "abort") return "abort";
  return "fix"; // retry, partial_retry, change_context, change_model comparten el nodo prepare_fix
}
```

Nota: este subgrafo **no vuelve a llamarse a sí mismo internamente**. Produce un `strategy` + una acción preparada, y es el `routeAfterRecovery` del Orchestrator (Capa 1) el que decide a qué nodo del grafo principal volver (`implementation`, `planning`, etc.). Así evitamos anidar loops de reintento dentro de loops de reintento — la memoria de "cuántas veces ya se intentó" vive en un solo lugar: `recoveryHistory` a nivel de ticket.

---

## 4. `diagnose`: profundizar la causa raíz, con memoria de intentos previos

```ts
// src/workflows/recovery/nodes/diagnose.ts
import { resolveModelForRole } from "../../../config/loadConfig";

export async function diagnoseNode(state: typeof RecoveryState.State) {
  const model = resolveModelForRole("recovery_diagnostician", state.config);

  const response = await model.invoke([
    { role: "system", content: DIAGNOSIS_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        failureCategory: state.failureCategory,       // veredicto OBJETIVO de la Capa 5
        validationEvidence: state.validationEvidence,  // logs crudos, sin interpretar
        lastPatchAttempt: state.patchAttempts.slice(-1)[0],
        recoveryHistory: state.recoveryHistory,        // qué ya se diagnosticó/intentó antes
      }),
    },
  ]);

  const diagnosis = parseDiagnosis(response.content);
  const isRepeated = state.recoveryHistory.some(
    (h) => h.diagnosis.rootCause === diagnosis.rootCause && h.diagnosis.detail === diagnosis.detail
  );

  return { diagnosis: { ...diagnosis, isRepeatedFailure: isRepeated } };
}

const DIAGNOSIS_PROMPT = `
Recibes el veredicto OBJETIVO de la Validation Pipeline (failureCategory) y su
evidencia cruda. Tu trabajo es profundizar la causa raíz — no re-verificar si
algo pasó o falló, eso ya está decidido.

Clasifica en: Compilation, Architecture, Tests, Runtime, Dependencies,
Formatting, Security.

Ejemplos de profundización:
- failureCategory "Compilation" + el error menciona un import hacia una capa
  que las reglas de arquitectura prohíben tocar → rootCause "Architecture",
  no "Compilation".
- failureCategory "Tests" + el mismo test falló de forma idéntica en 2
  intentos previos (ver recoveryHistory) → márcalo, esto es señal de
  "isRepeatedFailure", no un fallo nuevo.

Nunca inventes una causa que la evidencia no respalde. Si la evidencia es
ambigua entre dos categorías, usa "confidence: low" — no fuerces certeza.
`;
```

---

## 5. `decide_strategy`: reglas duras primero, juicio del modelo después

Esta es la parte más delicada del Recovery Loop, y por eso se diseña como **reglas determinísticas que tienen prioridad sobre cualquier sugerencia del modelo** — el modelo puede recomendar, pero ciertas condiciones fuerzan una estrategia sin negociación:

```ts
// src/workflows/recovery/nodes/decideStrategy.ts
export async function decideStrategyNode(state: typeof RecoveryState.State) {
  const { diagnosis, recoveryIteration, maxRecoveryIterations } = state;

  // Regla dura 1: presupuesto de recovery agotado -> abort, sin importar el diagnóstico
  if (recoveryIteration >= maxRecoveryIterations) {
    return { strategy: "abort" as const, recoveryIteration: recoveryIteration + 1 };
  }

  // Regla dura 2: Security SIEMPRE requiere aprobación humana, nunca autofix silencioso
  if (diagnosis!.rootCause === "Security") {
    return { strategy: "abort" as const, recoveryIteration: recoveryIteration + 1 }; // "abort" aquí = escalar, no continuar solo
  }

  // Regla dura 3: mismo error repetido -> cambiar de estrategia, NUNCA reintentar igual
  // (esto es literalmente "dejar de pensar en reintentar, empezar a pensar en cambiar de estrategia")
  if (diagnosis!.isRepeatedFailure) {
    if (diagnosis!.rootCause === "Architecture" || diagnosis!.rootCause === "Dependencies") {
      return { strategy: "change_context" as const, recoveryIteration: recoveryIteration + 1 };
      // change_context aquí significa: el Orchestrator vuelve a Planning, no a Implementation
    }
    return { strategy: "change_model" as const, recoveryIteration: recoveryIteration + 1 };
  }

  // Zona de juicio: para el resto, un modelo barato decide entre retry/partial_retry/rollback
  const model = resolveModelForRole("recovery_strategist", state.config);
  const response = await model.invoke([
    { role: "system", content: STRATEGY_PROMPT },
    { role: "user", content: JSON.stringify({ diagnosis }) },
  ]);

  return {
    strategy: parseStrategy(response.content),
    recoveryIteration: recoveryIteration + 1,
  };
}

const STRATEGY_PROMPT = `
Dado un diagnóstico de primera vez (no repetido) con rootCause en
{Compilation, Tests, Runtime, Formatting}, elige la estrategia menos
disruptiva que probablemente resuelva el problema:

- "retry": el error es puntual y aislado — un solo fix debería bastar.
- "partial_retry": el error afecta solo una parte de la task — no todo el
  patch necesita regenerarse, solo una porción acotada.
- "rollback": el patch introdujo una regresión que no vale la pena arreglar
  incrementalmente — mejor volver al último checkpoint estable.

No elijas "change_model" ni "change_context" aquí — esas ya se deciden por
regla dura cuando corresponde, no por tu juicio.
`;
```

Esto responde directamente al mandato de tu diseño original: **"el sistema deja de pensar en términos de reintentar y empieza a pensar en cambiar de estrategia"** — pero de forma auditable: las condiciones que fuerzan un cambio de estrategia son reglas explícitas y versionadas, no una decisión libre del modelo cada vez.

---

## 6. `prepare_fix`: la task acotada, nunca "regenerar todo"

```ts
// src/workflows/recovery/nodes/prepareFix.ts
export function prepareFixNode(state: typeof RecoveryState.State) {
  const { diagnosis, strategy } = state;

  const targetedFixTask: PlanTask = {
    id: `fix-${Date.now()}`,
    description: `Corrige específicamente: ${diagnosis!.detail}. No modifiques nada fuera de esto.`,
    touchesFiles: extractAffectedFiles(state.validationEvidence),
    hasExistingTest: diagnosis!.rootCause === "Tests",
    kind: "targeted_fix",
  };

  // Si la estrategia es change_model, esto se refleja en la config que lee
  // el Implementation Loop la próxima vez (resolveModelForRole("implementer", ...))
  const configPatch =
    strategy === "change_model" ? { roles: { implementer: nextFallbackModel(state.config) } } : {};

  return {
    targetedFixTask,
    strategy,
    config: { ...state.config, ...configPatch },
    recoveryHistory: [{
      iteration: state.recoveryIteration,
      diagnosis: diagnosis!,
      strategyChosen: strategy,
    }],
  };
}
```

Este es el nodo que hace literal el "Fix: solo corrige ese error, no vuelve a generar todo" de tu diseño: la `targetedFixTask` es deliberadamente estrecha (`touchesFiles` limitado a lo que la evidencia de fallo señala), y cuando vuelve al Implementation Loop, este la trata como **una task nueva y acotada**, no como "regenera el patch completo desde cero".

---

## 7. `prepare_rollback`: usa el checkpointer, no un `git revert` a ciegas

Como el Orchestrator (Capa 1) ya compila con un `checkpointer` de LangGraph (`PostgresSaver`), el rollback no es una operación de Git improvisada — es "time travel" nativo del framework: volver al estado del grafo anterior a que Planning generara el plan actual, descartando el sandbox worktree de la Capa 4.

```ts
// src/workflows/recovery/nodes/prepareRollback.ts
import { discardSandboxWorktree } from "../../../tools/sandbox";

export async function prepareRollbackNode(state: typeof RecoveryState.State) {
  await discardSandboxWorktree(state.targetedFixTask?.id ?? "current");

  return {
    strategy: "rollback" as const,
    // El Orchestrator, al ver strategy === "rollback", usa
    // orchestrator.updateState(config, { plan: null }, "planning")
    // para retomar desde antes del plan actual — no desde cero.
    recoveryHistory: [{
      iteration: state.recoveryIteration,
      diagnosis: state.diagnosis!,
      strategyChosen: "rollback" as const,
    }],
  };
}
```

---

## 8. Config y gobernanza

```yaml
# config/recovery.yml
roles:
  recovery_diagnostician:
    provider: anthropic
    model: claude-sonnet-5
  recovery_strategist:
    provider: anthropic
    model: claude-haiku-4-5-20251001   # decisión acotada, no necesita el modelo más caro
recovery:
  maxIterations: 3
  fallbackModelsForImplementer:        # usados por change_model, en orden
    - { provider: openrouter, model: "qwen/qwen3-coder" }
    - { provider: openai, model: "gpt-5.1" }
```

```markdown
<!-- .harness/governance/recovery.md -->
# Gobernanza del Recovery Loop

- Un diagnóstico con rootCause "Security" NUNCA se autofixea: siempre
  estrategia "abort" (= escalar a humano), sin excepción y sin importar
  cuántas iteraciones de presupuesto queden.
- Un mismo rootCause+detail repetido dos veces fuerza cambio de estrategia
  (change_context o change_model) — está prohibido reintentar exactamente
  igual una tercera vez.
- Máximo 3 iteraciones de Recovery por ticket. Al agotarse: abort con el
  `recoveryHistory` completo adjunto para revisión humana.
- `prepare_fix` nunca debe producir una `targetedFixTask` cuyo `touchesFiles`
  exceda los archivos ya señalados por la evidencia de fallo — si el
  diagnóstico sugiere que el problema es más amplio, eso es señal de que la
  estrategia correcta era `change_context` (volver a Planning), no un fix
  puntual más grande.
```

---

## 9. Integración con el Orchestrator

El nodo `recovery` de la Capa 1 deja de ser placeholder:

```ts
.addNode("recovery", recoveryWorkflow)
```

Y el `routeAfterRecovery` que definimos en la Capa 1 ahora lee un `state.strategy` que viene de reglas duras + diagnóstico real, no de un valor de ejemplo:

```ts
function routeAfterRecovery(state: typeof OrchestratorState.State) {
  if (state.strategy === "abort") return "abort";
  if (state.strategy === "change_model") return "change_model";     // -> implementation, config ya actualizado
  if (state.strategy === "change_context") return "retry_planning"; // -> planning
  if (state.strategy === "rollback") return "retry_planning";       // tras descartar el worktree
  return "retry_implementation";                                    // retry / partial_retry
}
```

Con esto, las capas 1 a 6 quedan completamente cerradas en loop: Orchestrator → Knowledge Engine → Planner → Implementation → Validation Pipeline → Recovery → (vuelve a Implementation, Planning, o cierra el ticket).

---

## 10. Siguiente paso lógico

Faltan dos piezas de tu diseño original para cerrar el ciclo completo del ticket: el **Quality Gate** (evalúa compila/tests/cobertura/arquitectura/seguridad/performance/docs/Sonar de forma holística, nunca modifica código, solo produce Issue+Evidence+Recommendation) y el **Merge Manager** (git status → diff → conflictos → merge → tag → cerrar ticket). El Quality Gate es el que decide si un ticket que pasó Validation Pipeline + Recovery está realmente listo para el Merge Manager, o si necesita review humano adicional.

¿Seguimos con Quality Gate, o prefieres saltar directo a Merge Manager?
