# How-To: Quality Gate — review-driven loop que nunca toca código

## 0. Numeración: por qué esto es "Capa 7" en tu diseño, no una capa 7 nueva

Vale aclarar algo antes de empezar: en tu documento original, después del Recovery Loop (que aquí llamamos Capa 6) aparece el **Quality Gate** como pieza adicional antes del Merge Manager — no es exactamente "Capa 7" de tu arquitectura final de 5 componentes, pero sí es el siguiente elemento de tu diagrama completo. Lo tratamos como la séptima guía de esta serie, consistente con el orden en que pediste construirlas.

Tu diseño es explícito en el patrón: en vez de agentes separados (Reviewer, Security, Performance, Architect), **un único loop** que pregunta secuencialmente Compila → Tests → Cobertura → Arquitectura → Seguridad → Performance → Documentación → Sonar, y que **nunca modifica código** — solo produce `Issue + Evidence + Recommendation`.

Esto es, en la taxonomía de loop engineering, un **review-driven loop** combinado con **maker-checker**: el "maker" es todo lo que ya pasó por las capas 4, 5 y 6; el Quality Gate es el "checker" holístico, independiente, que nunca decide fixes — solo produce hallazgos para que un humano (o el propio Recovery Loop, en casos acotados) decida qué hacer.

---

## 1. Diferencia real con la Validation Pipeline (Capa 5) — no la dupliques

Esta es la trampa más común al construir esto: repetir compile/tests/security que la Capa 5 ya corrió. El Quality Gate **reutiliza esa evidencia, no la vuelve a generar**:

| Pregunta del Quality Gate | Fuente |
|---|---|
| ¿Compila? | **Reusa** `state.validationEvidence` de la Capa 5 — no vuelve a compilar |
| ¿Tests? | **Reusa** de la Capa 5 |
| ¿Seguridad? | **Reusa** el resultado del scanner de la Capa 5 |
| ¿Performance? | **Reusa** si corrió (Capa 5 la hace opcional por riesgo) |
| **¿Cobertura?** | Nueva: delta de cobertura del patch vs. baseline — la Capa 5 no lo mide |
| **¿Arquitectura?** | Nueva: ajuste holístico a patrones/ADRs — más allá de "compiló", es "¿debería haberse hecho así?" |
| **¿Documentación?** | Nueva: ¿el patch actualiza docs/README/comentarios donde corresponde? |
| **¿Sonar?** | Nueva: deuda técnica, code smells, duplicación — señales que ni compile ni tests capturan |

Las primeras cuatro son **lectura de estado**, no ejecución de herramientas. Las últimas cuatro sí requieren trabajo nuevo — dos con herramientas (cobertura, Sonar) y dos con juicio de un modelo (arquitectura, documentación), siguiendo el mismo principio de "nivel 4 de la escalera de verificación" que usamos en Recovery: opinión informada, nunca disfrazada de hecho objetivo.

---

## 2. Estado del subgrafo

```ts
// src/workflows/quality-gate/state.ts
import { Annotation } from "@langchain/langgraph";

export const QualityGateState = Annotation.Root({
  // Reutilizado, no regenerado
  validationEvidence: Annotation<StageResult[]>({ reducer: (_, n) => n, default: () => [] }),
  plan: Annotation<Plan>({ reducer: (_, n) => n, default: () => null as any }),
  patch: Annotation<Patch>({ reducer: (_, n) => n, default: () => null as any }),
  sandboxPath: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),

  // Nuevo en esta capa
  coverageDelta: Annotation<CoverageResult | null>({ reducer: (_, n) => n, default: () => null }),
  sonarResult: Annotation<SonarResult | null>({ reducer: (_, n) => n, default: () => null }),
  architectureReview: Annotation<ReviewFinding | null>({ reducer: (_, n) => n, default: () => null }),
  documentationReview: Annotation<ReviewFinding | null>({ reducer: (_, n) => n, default: () => null }),

  // Salida final: SOLO esto sale del Quality Gate
  issues: Annotation<Issue[]>({ reducer: (_, n) => n, default: () => [] }),
  verdict: Annotation<"clear" | "advisory_only" | "blocking">({
    reducer: (_, n) => n,
    default: () => "clear",
  }),
});

interface Issue {
  dimension: "Compilation" | "Tests" | "Coverage" | "Architecture" | "Security" | "Performance" | "Documentation" | "Sonar";
  severity: "advisory" | "blocking";
  evidence: string;         // dato objetivo o cita concreta del review — nunca "se ve mal"
  recommendation: string;   // qué hacer — el Quality Gate lo sugiere, NUNCA lo aplica
}

interface CoverageResult { beforePct: number; afterPct: number; thresholdPct: number }
interface SonarResult { newCodeSmells: number; newDuplicationPct: number; qualityGatePassed: boolean }
interface ReviewFinding { compliant: boolean; findings: string[] }
```

El campo que hace cumplir "nunca modifica código" es simplemente la ausencia de cualquier campo tipo `fixedPatch` o `appliedChange` en el estado — estructuralmente, este subgrafo no tiene forma de tocar el sandbox de la Capa 4 salvo para leerlo.

---

## 3. El grafo

```ts
// src/workflows/quality-gate/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { QualityGateState } from "./state";

const builder = new StateGraph(QualityGateState)
  .addNode("check_coverage", checkCoverageNode)
  .addNode("check_sonar", checkSonarNode)
  .addNode("review_architecture", reviewArchitectureNode)
  .addNode("review_documentation", reviewDocumentationNode)
  .addNode("assemble_report", assembleReportNode)

  // Las 4 nuevas dimensiones no dependen entre sí -> fan-out/fan-in,
  // igual que hicimos con lint/static/security en la Capa 5
  .addEdge("__start__", "check_coverage")
  .addEdge("__start__", "check_sonar")
  .addEdge("__start__", "review_architecture")
  .addEdge("__start__", "review_documentation")
  .addEdge("check_coverage", "assemble_report")
  .addEdge("check_sonar", "assemble_report")
  .addEdge("review_architecture", "assemble_report")
  .addEdge("review_documentation", "assemble_report")
  .addEdge("assemble_report", END);

export const qualityGateWorkflow = builder.compile();
```

Las cuatro verificaciones nuevas no tienen dependencias entre sí (a diferencia de la Capa 5, donde compile debía ir antes que tests), así que todas arrancan directo desde `__start__` en paralelo — la forma más rápida de correr este gate sin sacrificar cobertura de análisis.

---

## 4. Los dos checks de herramienta: Coverage y Sonar

```ts
// src/workflows/quality-gate/nodes/checkCoverage.ts
import { runCommand } from "../../../tools/exec";

export async function checkCoverageNode(state: typeof QualityGateState.State) {
  const { command, thresholdPct } = state.config.qualityGate.coverage;
  const { stdout } = await runCommand(command, { cwd: state.sandboxPath });
  const { beforePct, afterPct } = parseCoverageOutput(stdout);

  return { coverageDelta: { beforePct, afterPct, thresholdPct } };
}
```

```ts
// src/workflows/quality-gate/nodes/checkSonar.ts
export async function checkSonarNode(state: typeof QualityGateState.State) {
  const result = await queryLocalSonarOrCloud(state.config.qualityGate.sonar, state.sandboxPath);
  return {
    sonarResult: {
      newCodeSmells: result.newCodeSmells,
      newDuplicationPct: result.newDuplicationPct,
      qualityGatePassed: result.qualityGatePassed,
    },
  };
}
```

Estos dos son deterministas — se ejecutan una sola vez y su resultado es un hecho, no una opinión. La ambigüedad entra recién en `assemble_report`, cuando se decide qué severidad asignarle a un delta de cobertura del 2% o a 3 code smells nuevos — eso sí depende de umbrales configurables (§6), no de intuición del modelo.

---

## 5. Los dos reviews de juicio: Arquitectura y Documentación

Aquí sí hay modelo-como-juez, y por eso se aplica el mismo principio de independencia del verificador que en capas anteriores: el rol `quality_gate_reviewer` es distinto de `implementer` y de `plan_validator`.

```ts
// src/workflows/quality-gate/nodes/reviewArchitecture.ts
import { resolveModelForRole } from "../../../config/loadConfig";
import { buildContextBlock } from "../../../config/loadContext";

export async function reviewArchitectureNode(state: typeof QualityGateState.State) {
  const model = resolveModelForRole("quality_gate_reviewer", state.config);
  const architecture = buildContextBlock("architecture"); // patterns.md, ADRs

  const response = await model.invoke([
    { role: "system", content: ARCHITECTURE_REVIEW_PROMPT },
    { role: "user", content: JSON.stringify({ patch: state.patch, plan: state.plan, architecture }) },
  ]);

  return { architectureReview: parseReviewFinding(response.content) };
}

const ARCHITECTURE_REVIEW_PROMPT = `
Evalúas si el patch, aunque compile y pase tests, encaja con los patrones y
ADRs del repo. Esto NO es "¿funciona?" — eso ya se verificó. Es "¿debería
haberse hecho así?".

Reporta findings concretos citando el ADR o patrón relevante — nunca una
opinión de estilo sin respaldo documental. No sugieras un patch: solo
describe el hallazgo y una recomendación en texto, para que un humano o el
Recovery Loop decidan si amerita una vuelta.
`;
```

```ts
// src/workflows/quality-gate/nodes/reviewDocumentation.ts
export async function reviewDocumentationNode(state: typeof QualityGateState.State) {
  const model = resolveModelForRole("quality_gate_reviewer", state.config);

  const response = await model.invoke([
    { role: "system", content: DOCUMENTATION_REVIEW_PROMPT },
    { role: "user", content: JSON.stringify({ patch: state.patch, plan: state.plan }) },
  ]);

  return { documentationReview: parseReviewFinding(response.content) };
}

const DOCUMENTATION_REVIEW_PROMPT = `
¿El patch introduce comportamiento público (endpoint, config, comando,
parámetro) que debería reflejarse en README, CLAUDE.md del repo destino, o
comentarios de código, y no lo hace? Marca compliant:false SOLO si hay una
omisión concreta y señalable — no penalices por "podría documentarse mejor"
de forma genérica.
`;
```

---

## 6. `assemble_report`: agregación con umbrales configurables, no con vibra

```ts
// src/workflows/quality-gate/nodes/assembleReport.ts
export function assembleReportNode(state: typeof QualityGateState.State) {
  const issues: Issue[] = [];
  const { coverage, sonar } = state.config.qualityGate;

  // Compilation / Tests / Security / Performance: solo se reportan si YA
  // fallaron en la Capa 5 — nunca se re-evalúan aquí.
  for (const r of state.validationEvidence.filter((r) => !r.passed)) {
    issues.push({
      dimension: r.stage as Issue["dimension"],
      severity: "blocking",
      evidence: r.evidence,
      recommendation: "Ya señalado por Validation Pipeline — no requiere nuevo análisis.",
    });
  }

  const covDrop = state.coverageDelta!.beforePct - state.coverageDelta!.afterPct;
  if (covDrop > coverage.maxDropPct) {
    issues.push({
      dimension: "Coverage",
      severity: covDrop > coverage.blockingDropPct ? "blocking" : "advisory",
      evidence: `Cobertura bajó ${covDrop.toFixed(1)}pp (${state.coverageDelta!.beforePct}% → ${state.coverageDelta!.afterPct}%)`,
      recommendation: "Agregar tests para las líneas nuevas sin cobertura.",
    });
  }

  if (!state.sonarResult!.qualityGatePassed) {
    issues.push({
      dimension: "Sonar",
      severity: state.sonarResult!.newCodeSmells > sonar.blockingSmellCount ? "blocking" : "advisory",
      evidence: `${state.sonarResult!.newCodeSmells} code smells nuevos, ${state.sonarResult!.newDuplicationPct}% duplicación`,
      recommendation: "Revisar hotspots reportados por Sonar antes de acumular deuda técnica.",
    });
  }

  if (!state.architectureReview!.compliant) {
    issues.push({
      dimension: "Architecture",
      severity: "blocking", // desalineación arquitectónica siempre bloquea, nunca es solo advisory
      evidence: state.architectureReview!.findings.join("; "),
      recommendation: "Revisar contra el ADR/patrón citado antes de mergear.",
    });
  }

  if (!state.documentationReview!.compliant) {
    issues.push({
      dimension: "Documentation",
      severity: "advisory", // documentación faltante nunca bloquea el merge por sí sola
      evidence: state.documentationReview!.findings.join("; "),
      recommendation: "Actualizar README/CLAUDE.md antes del próximo ciclo, no bloquea este merge.",
    });
  }

  const verdict = issues.some((i) => i.severity === "blocking")
    ? "blocking"
    : issues.length > 0
    ? "advisory_only"
    : "clear";

  return { issues, verdict };
}
```

Nota de diseño: la severidad no es una decisión libre del modelo — está codificada como regla (`Architecture` siempre bloquea si no cumple, `Documentation` nunca bloquea sola, `Coverage`/`Sonar` dependen de umbrales de config). Esto mantiene auditable y predecible qué detiene un merge y qué no.

---

## 7. Config y gobernanza

```yaml
# config/quality-gate.yml
roles:
  quality_gate_reviewer:
    provider: anthropic
    model: claude-opus-4-8
qualityGate:
  coverage:
    command: "npm run coverage:report -- --json"
    maxDropPct: 0.5       # a partir de aquí ya se reporta como advisory
    blockingDropPct: 5.0  # a partir de aquí bloquea
  sonar:
    blockingSmellCount: 10
```

```markdown
<!-- .harness/governance/quality-gate.md -->
# Gobernanza del Quality Gate

- El Quality Gate NUNCA modifica código ni aplica sus propias recomendaciones.
  Su única salida es `issues[]` + `verdict`.
- Compilation/Tests/Security/Performance nunca se re-ejecutan aquí — se leen
  de `validationEvidence` (Capa 5). Duplicar esas corridas es un error de
  implementación, no una mejora de cobertura de análisis.
- Un issue de dimensión "Architecture" siempre es "blocking" — nunca
  "advisory" — porque una desalineación arquitectónica aceptada sin revisión
  humana es exactamente el tipo de deuda que este harness existe para evitar.
- Un issue de dimensión "Documentation" nunca bloquea el merge por sí solo:
  se registra como advisory y se convierte en un ticket de seguimiento en
  el backlog del Orchestrator (`state.backlog`, Capa 1), no en un bloqueo del
  ticket actual.
- Verdict "blocking": el ticket vuelve al Recovery Loop (Capa 6) con las
  `issues` de severidad blocking como entrada — reutilizando su nodo
  `diagnose`, no un mecanismo nuevo de reintento.
```

---

## 8. Integración con el Orchestrator y con Recovery

```ts
// En src/orchestrator/graph.ts
.addNode("quality_gate", qualityGateWorkflow)
.addEdge("validation_pipeline", "quality_gate")   // solo si validation_pipeline dio "pass"
.addConditionalEdges("quality_gate", routeAfterQualityGate, {
  clear: "select_next_ticket",       // listo para Merge Manager
  advisory_only: "select_next_ticket", // sigue, pero encola tickets de seguimiento
  blocking: "recovery",
});
```

```ts
function routeAfterQualityGate(state: typeof OrchestratorState.State) {
  if (state.qualityGate.verdict === "advisory_only") {
    // Encola issues advisory como tickets nuevos, de baja prioridad
    state.backlog.push(...toFollowUpTickets(state.qualityGate.issues));
  }
  return state.qualityGate.verdict === "blocking" ? "recovery" : "clear";
}
```

Cuando `verdict === "blocking"`, el Recovery Loop recibe los `issues` de severidad blocking como si fueran un `failureCategory` más — su nodo `diagnose` (Capa 6) ya sabe interpretar `Architecture`/`Security` como rootCause; solo hace falta extender esa entrada para aceptar además `issues: Issue[]` del Quality Gate como fuente alternativa de evidencia, sin cambiar el resto del subgrafo de Recovery.

---

## 9. Siguiente paso lógico

Con esto, un ticket que llega "clear" o "advisory_only" del Quality Gate está objetivamente listo para mergearse. Falta la última pieza de tu arquitectura original: el **Merge Manager** — `git status → diff → conflictos → merge → tag → cerrar ticket`. Es la más simple de las siete capas (no necesita LLM en el camino crítico, es prácticamente automatización de Git), y cierra el ciclo completo: Orchestrator → Knowledge Engine → Planner → Implementation → Validation Pipeline → Recovery ↔ Quality Gate → Merge Manager → siguiente ticket.

¿Seguimos con esa?
