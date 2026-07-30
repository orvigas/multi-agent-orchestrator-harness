# How-To: Implementation Loop (Capa 4) — un único loop, sin agentes por stack

## 0. Lo que NO vamos a construir

Tu diseño es explícito en esto y lo respalda la evidencia de 2025-2026: nada de agente-Java, agente-Angular, agente-Docker. Un único **Implementation Loop** que recibe `Task + Context + Rules` y devuelve un `Patch`. El modelo ya sabe distinguir Java de Angular por el propio código — la especialización vive en el prompt/contexto, no en agentes separados.

Lo que sí varía por task es el **patrón de loop** que mejor le queda, según la tabla de selección de patrones que ya usamos en capas anteriores:

| Condición de la task | Patrón | Por qué |
|---|---|---|
| Tiene tests existentes o se puede escribir uno que encierre el comportamiento esperado | **Test-driven loop** | Señal de éxito ejecutable y objetiva |
| Lenguaje tipado, refactor estructural, migración de interfaz | **Compiler-driven loop** | El compilador/type-checker da feedback preciso sin necesidad de tests nuevos |
| Fix pequeño y acotado (formato, import, off-by-one) | **Retry loop** | Sobra estructura; un ciclo simple de reintento basta |

El Implementation Loop no es "uno de estos tres" fijo — es un loop que **elige** el patrón correcto por task, en el nodo `select_pattern`.

---

## 1. Formato de patch: por qué no usar números de línea

Antes del código, una decisión de diseño que importa más de lo que parece. La generación de patches por LLM convergió en 2025-2026 hacia formatos de **diff basados en contexto** (bloques con líneas de contexto antes/después) en vez de diffs por número de línea — exactamente el mismo problema que resolvimos en la Capa 2 con progressive disclosure: en un flujo multi-turno, el archivo puede haber cambiado entre que el modelo lo leyó y generó el patch, así que un número de línea puede apuntar al lugar equivocado. Herramientas como `apply_patch`/V4A (Codex) y los editores de Aider usan hunks con contexto y *fuzzy matching* de indentación en vez de `line:col`.

Para tu harness, esto se traduce en una regla simple: **el Implementer nunca emite números de línea**, solo bloques con contexto (unas líneas antes y después del cambio) y el texto exacto a reemplazar. Tu harness aplica el patch localizando ese contexto en el archivo actual, no una posición fija.

```ts
interface PatchHunk {
  file: string;
  contextBefore: string[]; // 2-3 líneas antes, tal cual existen en el archivo
  oldLines: string[];      // lo que se reemplaza (debe matchear exacto o casi-exacto)
  newLines: string[];      // el reemplazo
  contextAfter: string[];
}

interface Patch {
  taskId: string;
  hunks: PatchHunk[];
  rationale: string;       // por qué este cambio satisface la task, para el Quality Gate
}
```

---

## 2. Estado del subgrafo

```ts
// src/workflows/implementation/state.ts
import { Annotation } from "@langchain/langgraph";

export const ImplementationState = Annotation.Root({
  task: Annotation<PlanTask>({ reducer: (_, n) => n, default: () => null as any }),
  taskContext: Annotation<EvidenceItem[]>({ reducer: (_, n) => n, default: () => [] }),

  selectedPattern: Annotation<"test_driven" | "compiler_driven" | "retry">({
    reducer: (_, n) => n,
    default: () => "retry",
  }),

  patch: Annotation<Patch | null>({ reducer: (_, n) => n, default: () => null }),
  patchAttempts: Annotation<PatchAttempt[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Señal rápida ANTES de mandarlo a la Validation Pipeline completa (Capa 5)
  quickCheck: Annotation<{ passed: boolean; signal: string; detail: string } | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),

  iteration: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  maxIterations: Annotation<number>({ reducer: (_, n) => n, default: () => 3 }),
  outcome: Annotation<"ready_for_validation" | "escalate">({
    reducer: (_, n) => n,
    default: () => "ready_for_validation",
  }),
});

interface PatchAttempt {
  iteration: number;
  patch: Patch;
  quickCheckResult: { passed: boolean; signal: string; detail: string };
}
```

Nota deliberada: `quickCheck` no es la Validation Pipeline completa (Capa 5: compile→tests→lint→static→security→performance). Es una señal **rápida y barata** — compilar solo los archivos tocados, o correr solo el test relacionado con la task — para no gastar una corrida completa de pipeline en cada intento interno del Implementation Loop. La pipeline completa se corre una sola vez, cuando el patch ya pasó su propio quick-check.

---

## 3. El grafo

```ts
// src/workflows/implementation/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { ImplementationState } from "./state";

const builder = new StateGraph(ImplementationState)
  .addNode("select_pattern", selectPatternNode)
  .addNode("gather_task_context", gatherTaskContextNode)   // just-in-time, reusa Knowledge Engine
  .addNode("generate_patch", generatePatchNode)
  .addNode("apply_in_sandbox", applyInSandboxNode)
  .addNode("quick_check", quickCheckNode)
  .addNode("escalate", escalateNode)

  .addEdge("__start__", "select_pattern")
  .addEdge("select_pattern", "gather_task_context")
  .addEdge("gather_task_context", "generate_patch")
  .addEdge("generate_patch", "apply_in_sandbox")
  .addEdge("apply_in_sandbox", "quick_check")
  .addConditionalEdges("quick_check", routeAfterQuickCheck, {
    ready: END,               // pasa a la Capa 5 completa
    retry: "generate_patch",  // vuelve a intentar CON el feedback del quick_check
    escalate: "escalate",
  })
  .addEdge("escalate", END);

export const implementationWorkflow = builder.compile();
```

```ts
function routeAfterQuickCheck(state: typeof ImplementationState.State) {
  if (state.quickCheck?.passed) return "ready";
  if (state.iteration >= state.maxIterations) return "escalate";
  return "retry";
}
```

---

## 4. `select_pattern`: elegir el loop correcto por task

```ts
// src/workflows/implementation/nodes/selectPattern.ts
export function selectPatternNode(state: typeof ImplementationState.State) {
  const { task } = state;

  if (task.hasExistingTest || task.expectedBehaviorIsTestable) {
    return { selectedPattern: "test_driven" as const };
  }
  if (task.language === "typed" || task.kind === "refactor" || task.kind === "migration") {
    return { selectedPattern: "compiler_driven" as const };
  }
  return { selectedPattern: "retry" as const };
}
```

Este campo (`selectedPattern`) no cambia el grafo — cambia **qué cuenta como quick-check** en el nodo `quick_check` (sección 6) y **qué feedback recibe** el siguiente intento de `generate_patch`.

---

## 5. `generate_patch`: un único prompt, contexto especializado

Aquí es literalmente donde vive "la especialización en el prompt, no en agentes separados":

```ts
// src/workflows/implementation/nodes/generatePatch.ts
import { resolveModelForRole } from "../../../config/loadConfig";
import { buildContextBlock } from "../../../config/loadContext";

export async function generatePatchNode(state: typeof ImplementationState.State) {
  const model = resolveModelForRole("implementer", state.config);
  const rules = buildContextBlock("rules");             // incluye forbidden-zones.md
  const lastAttempt = state.patchAttempts.slice(-1)[0];

  const response = await model.invoke([
    { role: "system", content: IMPLEMENTER_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        task: state.task,
        context: state.taskContext,        // evidencia acotada, no el repo completo
        rules,
        pattern: state.selectedPattern,
        previousAttempt: lastAttempt ?? null,
        previousQuickCheckFeedback: lastAttempt?.quickCheckResult?.detail ?? null,
      }),
    },
  ]);

  const patch = parsePatch(response.content);
  return {
    patch,
    iteration: state.iteration + 1,
    patchAttempts: [{ iteration: state.iteration + 1, patch, quickCheckResult: null as any }],
  };
}

const IMPLEMENTER_PROMPT = `
Eres el Implementation Loop. Recibes una task, contexto acotado y reglas.
Devuelves ÚNICAMENTE un patch en formato de hunks con contexto (nunca
números de línea) — ver especificación de PatchHunk.

No importa si el archivo es Java, TypeScript, SQL o YAML: infiere el
lenguaje y las convenciones del propio "context" entregado, no asumas nada
que no esté ahí.

Reglas duras (nunca las violes, vienen de rules.forbidden-zones):
- Nunca toques archivos fuera de "task.touchesFiles" sin justificarlo
  explícitamente en "rationale".
- Si la task requeriría tocar una zona prohibida, no generes el patch:
  devuelve un patch vacío con rationale explicando por qué, para que el
  Orchestrator escale.

Si "pattern" es "test_driven": incluye en el patch, si no existe ya, un test
que encierre el comportamiento esperado ANTES de la implementación.
Si "pattern" es "compiler_driven": prioriza que el cambio compile/tipe
correctamente sobre cualquier otra consideración estética.
Si "previousQuickCheckFeedback" no es null, corrige específicamente ese
error — no regeneres el patch desde cero.
`;
```

---

## 6. `apply_in_sandbox` + `quick_check`: nunca tocar la rama real

```ts
// src/workflows/implementation/nodes/applyInSandbox.ts
import { createSandboxWorktree, applyPatchToWorktree } from "../../../tools/sandbox";

export async function applyInSandboxNode(state: typeof ImplementationState.State) {
  const worktree = await createSandboxWorktree(state.task.taskId); // git worktree aislado, no la rama de trabajo
  const applyResult = await applyPatchToWorktree(worktree, state.patch!);
  return { sandboxPath: worktree.path, applyResult };
}
```

```ts
// src/workflows/implementation/nodes/quickCheck.ts
import { runCompileCheck, runSingleTest } from "../../../tools/quickChecks";

export async function quickCheckNode(state: typeof ImplementationState.State) {
  const { selectedPattern, task, sandboxPath } = state as any;

  let result: { passed: boolean; signal: string; detail: string };

  if (selectedPattern === "test_driven") {
    result = await runSingleTest(sandboxPath, task.relatedTestId); // solo ESE test, no la suite completa
  } else if (selectedPattern === "compiler_driven") {
    result = await runCompileCheck(sandboxPath, state.patch!.hunks.map((h) => h.file));
  } else {
    // retry loop: la señal más barata disponible (lint del archivo tocado, por ejemplo)
    result = await runCompileCheck(sandboxPath, state.patch!.hunks.map((h) => h.file));
  }

  // Actualiza el último intento con el resultado del check
  const attempts = [...state.patchAttempts];
  attempts[attempts.length - 1] = { ...attempts[attempts.length - 1], quickCheckResult: result };

  return { quickCheck: result, patchAttempts: attempts };
}
```

El punto de fondo: **cada patrón define qué es "suficiente" para pasar del Implementation Loop a la Validation Pipeline completa**, pero ninguno reemplaza a la Capa 5 — solo evita mandarle basura. Un patch que pasa su propio test relacionado o compila puede aun así fallar lint, seguridad o performance; eso lo decide la Capa 5, no este loop.

---

## 7. Config

```yaml
# config/implementation.yml
roles:
  implementer:
    provider: anthropic
    model: claude-opus-4-8    # la task de generar código se beneficia de más razonamiento
implementation:
  maxIterationsPerTask: 3
  sandbox:
    mode: git-worktree        # nunca aplicar directo sobre la rama de trabajo
    cleanupOnEscalate: false  # deja el worktree para inspección humana
```

---

## 8. Integración con el Orchestrator

En `src/orchestrator/graph.ts`, el nodo `implementation` deja de ser placeholder — es este subgrafo, y se invoca **una vez por cada task del plan** (el Orchestrator itera `state.plan.order`, no el subgrafo):

```ts
.addNode("implementation", implementationWorkflow)
```

`routeAfterImplementation` (definido en la Capa 1) ahora recibe la salida real: `pass` cuando el patch de todas las tasks quedó en `ready_for_validation` y pasó además la Validation Pipeline (Capa 5, siguiente how-to); `fail` dispara Recovery con el `sandboxPath` y el historial de `patchAttempts` como evidencia de diagnóstico — exactamente el "diagnóstico → estrategia → fix puntual" de tu Capa 6.

---

## 9. Gobernanza propia

```markdown
<!-- .harness/governance/implementation.md -->
# Gobernanza del Implementation Loop

- Máximo 3 intentos de patch por task antes de escalar. El worktree de sandbox
  del último intento fallido NO se borra — queda para inspección humana.
- El Implementer nunca aplica un patch directo a la rama de trabajo: siempre
  vía git worktree aislado (config/implementation.yml → sandbox.mode).
- Si una task tocaría una ruta de `.harness/rules/forbidden-zones.md`, el
  Implementer debe devolver un patch vacío con rationale, nunca forzar el
  cambio.
- El quick-check nunca sustituye a la Validation Pipeline completa (Capa 5):
  solo filtra patches obviamente rotos antes de gastar una corrida completa.
```

---

## 10. Siguiente paso lógico

Con el Implementation Loop generando patches en sandbox, filtrados por un quick-check barato y específico por patrón, el siguiente how-to natural es la **Capa 5 — Validation Pipeline**: el paso que corre compile→tests→lint→static analysis→security→performance sobre el patch completo (no solo el archivo tocado) y que produce el veredicto real `pass`/`fail` que consume `routeAfterImplementation`.

¿Seguimos con esa, o prefieres ir directo al Recovery Loop (Capa 6), que ya varios nodos están esperando (`routeAfterRecovery`, `retry_implementation`)?
