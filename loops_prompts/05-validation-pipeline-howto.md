# How-To: Validation Pipeline (Capa 5) — evidencia, no opiniones

## 0. Por qué esta capa NO es un "loop" como las anteriores

Vale la pena decirlo explícito porque rompe el patrón de las capas 1-4: la Validation Pipeline **no reintenta, no decide, no interpreta**. Tu propio diseño lo dice: "cada paso genera evidencia, no opiniones." En términos de LEAF, esta capa es *solo* las capas **tool-and-action** y **observation** — deliberadamente separada de **verification** (que aquí se reduce a pass/fail objetivo por herramienta) y completamente separada de la **estrategia** (eso es 100% del Recovery Loop, Capa 6).

Esto importa porque es tentador meterle a esta capa un LLM que "interprete si el fallo es grave" o que "decida si vale la pena reintentar". No lo hagas aquí. Si un LLM entra a esta capa, deja de ser evidencia objetiva y se convierte en opinión — exactamente lo que tu diseño quiere evitar. La interpretación vive en Recovery (diagnóstico) y en Quality Gate; aquí solo corren herramientas reales y se registra lo que dijeron.

Por eso la Validation Pipeline se modela mejor como un **grafo determinístico fail-fast con etapas en paralelo**, no como un loop con `maxIterations`.

---

## 1. Orden de las etapas: por qué compile va primero y performance al final

```
Compile → Tests → (Lint ‖ Static Analysis ‖ Security) → Performance
```

- **Compile primero**: es la señal más barata y más determinante — si no compila, cualquier otra evidencia (lint, seguridad) es irrelevante. Fail-fast aquí ahorra minutos.
- **Tests después de compile**: no tiene sentido correr tests sobre código que no compila.
- **Lint, Static Analysis y Security en paralelo**: no dependen entre sí, solo de que el código compile. Corrarlas en paralelo (fan-out/fan-in) reduce la latencia total de la pipeline sin perder cobertura.
- **Performance al final y opcional**: es la etapa más costosa (benchmarks, carga) y la que menos aporta si ya fallaste algo antes. Además, no todas las tasks lo ameritan — gobernado por riesgo (ver §6).

---

## 2. Estado del subgrafo

```ts
// src/workflows/validation-pipeline/state.ts
import { Annotation } from "@langchain/langgraph";

export const ValidationState = Annotation.Root({
  sandboxPath: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  patch: Annotation<Patch>({ reducer: (_, n) => n, default: () => null as any }),
  task: Annotation<PlanTask>({ reducer: (_, n) => n, default: () => null as any }),

  results: Annotation<StageResult[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  verdict: Annotation<"pass" | "fail" | null>({ reducer: (_, n) => n, default: () => null }),
  failureCategory: Annotation<FailureCategory | null>({ reducer: (_, n) => n, default: () => null }),
});

interface StageResult {
  stage: "compile" | "tests" | "lint" | "static_analysis" | "security" | "performance";
  passed: boolean;
  durationMs: number;
  evidence: string;        // salida cruda de la herramienta, truncada, NUNCA interpretada
  exitCode: number;
}

// Esta taxonomía es la misma que va a consumir el Recovery Loop (Capa 6) para
// diagnosticar — definirla aquí evita inventar otra en la siguiente guía.
type FailureCategory =
  | "Compilation" | "Tests" | "Formatting" | "Security"
  | "Performance" | "StaticAnalysis";
```

---

## 3. El grafo: fail-fast + fan-out/fan-in

LangGraph soporta nodos que se disparan en paralelo y un nodo de unión (*deferred node*) que espera a que todos los caminos paralelos terminen antes de continuar — exactamente el patrón map-reduce que necesitas para lint/static/security.

```ts
// src/workflows/validation-pipeline/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { ValidationState } from "./state";

const builder = new StateGraph(ValidationState)
  .addNode("compile", compileNode)
  .addNode("tests", testsNode)
  .addNode("lint", lintNode)
  .addNode("static_analysis", staticAnalysisNode)
  .addNode("security", securityNode)
  .addNode("join_parallel_checks", joinParallelChecksNode) // deferred: espera lint+static+security
  .addNode("performance", performanceNode)
  .addNode("assemble_verdict", assembleVerdictNode)

  .addEdge("__start__", "compile")
  .addConditionalEdges("compile", routeAfterCompile, {
    continue: "tests",
    fail_fast: "assemble_verdict",   // no compiló: no sigas gastando tiempo
  })
  .addConditionalEdges("tests", routeAfterTests, {
    continue: "lint",               // fan-out empieza aquí
    fail_fast: "assemble_verdict",
  })
  // fan-out: los tres corren en paralelo, todos apuntan al mismo join
  .addEdge("tests", "static_analysis")
  .addEdge("tests", "security")
  .addEdge("lint", "join_parallel_checks")
  .addEdge("static_analysis", "join_parallel_checks")
  .addEdge("security", "join_parallel_checks")

  .addConditionalEdges("join_parallel_checks", routeAfterParallelChecks, {
    continue: "performance",
    fail_fast: "assemble_verdict",
  })
  .addEdge("performance", "assemble_verdict")
  .addEdge("assemble_verdict", END);

export const validationPipelineWorkflow = builder.compile();
```

```ts
function routeAfterCompile(state: typeof ValidationState.State) {
  const compileResult = state.results.find((r) => r.stage === "compile");
  return compileResult?.passed ? "continue" : "fail_fast";
}

function routeAfterTests(state: typeof ValidationState.State) {
  const testResult = state.results.find((r) => r.stage === "tests");
  return testResult?.passed ? "continue" : "fail_fast";
}

function routeAfterParallelChecks(state: typeof ValidationState.State) {
  const parallel = state.results.filter((r) =>
    ["lint", "static_analysis", "security"].includes(r.stage)
  );
  const allPassed = parallel.every((r) => r.passed);
  // performance solo corre si TODO lo anterior pasó Y la task lo amerita (§6)
  return allPassed ? "continue" : "fail_fast";
}
```

> Nota de implementación: `addConditionalEdges("tests", ...)` con destino `"continue": "lint"` más los `addEdge` directos de `tests → static_analysis` y `tests → security` es la forma de expresar fan-out en LangGraph — los tres nodos quedan programados para ejecutarse en paralelo una vez que `tests` resuelve a `continue`. `join_parallel_checks` es el nodo diferido que no se ejecuta hasta que sus tres predecesores terminan.

---

## 4. Los nodos: herramientas reales, sin LLM

Esto es deliberadamente aburrido — es tooling, no IA:

```ts
// src/workflows/validation-pipeline/nodes/compile.ts
import { runCommand } from "../../../tools/exec";

export async function compileNode(state: typeof ValidationState.State) {
  const cmd = state.config.validation.compileCommand; // ej. "mvn compile -q" o "tsc --noEmit"
  const start = Date.now();
  const { exitCode, stdout, stderr } = await runCommand(cmd, { cwd: state.sandboxPath, timeoutMs: 120_000 });

  return {
    results: [{
      stage: "compile" as const,
      passed: exitCode === 0,
      durationMs: Date.now() - start,
      evidence: truncate(stdout + stderr, 4000),
      exitCode,
    }],
  };
}
```

```ts
// src/workflows/validation-pipeline/nodes/tests.ts
export async function testsNode(state: typeof ValidationState.State) {
  // Corre SOLO los tests afectados por los archivos del patch cuando el
  // runner lo soporta (ej. --findRelatedTests en Jest, --tests en Maven),
  // y la suite completa solo si la task es de alto riesgo (config §6).
  const affectedFiles = state.patch.hunks.map((h) => h.file);
  const cmd = buildTestCommand(state.config.validation, affectedFiles);
  const start = Date.now();
  const { exitCode, stdout, stderr } = await runCommand(cmd, { cwd: state.sandboxPath, timeoutMs: 300_000 });

  return {
    results: [{
      stage: "tests" as const,
      passed: exitCode === 0,
      durationMs: Date.now() - start,
      evidence: truncate(stdout + stderr, 6000),
      exitCode,
    }],
  };
}
```

Los nodos `lint`, `static_analysis` y `security` siguen exactamente el mismo patrón (`runCommand` + registrar `StageResult`), solo cambia el comando configurado. No los repito por brevedad, pero la simetría es intencional: **el contrato de cada etapa es idéntico**, cambia solo qué binario invoca.

```ts
// src/workflows/validation-pipeline/nodes/joinParallelChecks.ts
export function joinParallelChecksNode(state: typeof ValidationState.State) {
  // Nodo puramente de sincronización — LangGraph ya esperó a los 3 fan-out.
  // No necesita lógica propia; existe para tener un punto de conditional edge.
  return {};
}
```

```ts
// src/workflows/validation-pipeline/nodes/assembleVerdict.ts
export function assembleVerdictNode(state: typeof ValidationState.State) {
  const failed = state.results.find((r) => !r.passed);
  if (!failed) return { verdict: "pass" as const };

  return {
    verdict: "fail" as const,
    failureCategory: mapStageToCategory(failed.stage),
  };
}

function mapStageToCategory(stage: StageResult["stage"]): FailureCategory {
  const map: Record<StageResult["stage"], FailureCategory> = {
    compile: "Compilation",
    tests: "Tests",
    lint: "Formatting",
    static_analysis: "StaticAnalysis",
    security: "Security",
    performance: "Performance",
  };
  return map[stage];
}
```

---

## 5. Config: agnóstico de stack, un comando por proyecto

Esta es la pieza que hace la pipeline "usable sin importar el stack técnico" — el módulo no sabe si es Maven, npm o Cargo, solo ejecuta lo que el `.harness`/config del proyecto destino le indica:

```yaml
# config/validation-pipeline.yml (vive en projects/<nombre>/.harness/ o en la raíz del repo destino)
validation:
  compileCommand: "mvn -q compile"
  testCommand: "mvn -q test -Dtest={testClasses}"   # {testClasses} se resuelve por archivos tocados
  lintCommand: "npm run lint -- {files}"
  staticAnalysisCommand: "sonar-scanner -Dsonar.projectKey=my-project"
  securityCommand: "trivy fs --exit-code 1 ."
  performance:
    enabled: false            # se activa por task, no globalmente (ver §6)
    command: "k6 run perf/smoke.js"
  timeouts:
    compileMs: 120000
    testsMs: 300000
    lintMs: 60000
    staticAnalysisMs: 180000
    securityMs: 180000
    performanceMs: 600000
```

Cambiar de stack (Java→Node, Maven→Gradle) es **editar este YAML**, no tocar el grafo ni el código del harness — exactamente el requisito de reutilización que pediste desde el principio.

---

## 6. Gobernanza: performance no corre gratis en cada patch

```markdown
<!-- .harness/governance/validation-pipeline.md -->
# Gobernanza de la Validation Pipeline

- `performance` solo se activa cuando `task.riskLevel` es "medium" o "high"
  (definido por Discovery en la Capa 3) o cuando el patch toca rutas listadas
  en `.harness/architecture/performance-sensitive.md`. Correrlo en cada patch
  de bajo riesgo desperdicia presupuesto sin aportar señal nueva.
- Ninguna etapa puede tener un LLM en el camino crítico de pass/fail. Si en
  el futuro se agrega un check "asistido por IA" (ej. revisión de
  vulnerabilidades no cubiertas por el scanner), su resultado va a
  `evidence` como dato adicional, nunca sustituye el exit code de la
  herramienta real.
- Toda `evidence` se trunca (ver `truncate()`) pero se conserva el log
  completo en el sandbox del patch para inspección humana — nunca se
  descarta, solo se resume lo que entra al state del grafo.
- Timeout por etapa es obligatorio (config `validation.timeouts`). Una
  herramienta que cuelga cuenta como `fail` con `evidence: "timeout"`, no
  como corrida indefinida.
```

---

## 7. Integración con el Orchestrator

Esta pipeline se invoca **dentro** del nodo `implementation` de la Capa 4 (después de que `quick_check` da `ready`), o como un nodo separado justo después, según prefieras separar responsabilidades:

```ts
// Opción recomendada: nodo propio en el grafo del Orchestrator,
// entre implementation y la decisión de pass/fail
.addNode("validation_pipeline", validationPipelineWorkflow)
.addEdge("implementation", "validation_pipeline")
.addConditionalEdges("validation_pipeline", routeAfterImplementation, {
  pass: "select_next_ticket",
  fail: "recovery",
});
```

Y ahora `routeAfterImplementation` (que en la Capa 1 dejamos como placeholder conceptual) tiene una fuente real: `state.verdict` y `state.failureCategory` de este subgrafo — que es exactamente el dato de entrada que el diagnóstico de Recovery (Capa 6) necesita para decidir su estrategia.

---

## 8. Siguiente paso lógico

Con evidencia objetiva y categorizada (`failureCategory`) saliendo de esta pipeline, el siguiente how-to es el que le da sentido a todo el "cambio dinámico de estrategia" que venimos preparando desde la Capa 1: el **Recovery Loop (Capa 6)** — diagnóstico → estrategia → fix puntual — que consume exactamente `failureCategory` + el `sandboxPath` + el historial de `patchAttempts` de la Capa 4 para decidir entre reintentar implementación, volver a Planning, cambiar de modelo, o escalar.

¿Seguimos con esa?
