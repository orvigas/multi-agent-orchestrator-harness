# How-To: Merge Manager (Capa 8) — automatización determinística final

## 0. Por qué NO es un loop: simplemente automatización

A diferencia de todas las capas anteriores (1-7 son loops LEAF de alguna forma: Discovery→Planning→Validation retiene, test-driven loops, recover loops), el Merge Manager es **determinístico y lineal**. No tiene:

- Conditional edges dentro de sí mismo (salvo fail-fast en conflictos irresolubles)
- Reintentos o estrategias alternativas
- Modelo-como-juez

Tiene:
- Una secuencia de pasos: `git status → git diff → detect conflictos → resolve-if-safe → merge → tag → close ticket`
- Reglas binarias: "¿hay conflictos?" → Sí/No
- Escalación explícita a humano (rama protegida, conflictos no resolubles, fallos de permiso)

En la taxonomía de loop engineering, esto es **no un loop**, sino **un workflow determinístico** — el equivalente a un GitHub Action que corre con permisos acotados y audita cada paso. La razón de incluirlo en esta serie es que cierra el ciclo del Orchestrator: el ticket que llega del Quality Gate con veredicto "clear" o "advisory_only" se mergea, se taguea y se cierra *automáticamente*, sin esperar a que alguien manualmente escriba comandos git.

---

## 1. Estado mínimo

```ts
// src/workflows/merge-manager/state.ts
import { Annotation } from "@langchain/langgraph";

export const MergeManagerState = Annotation.Root({
  ticket: Annotation<Ticket>({ reducer: (_, n) => n, default: () => null as any }),
  plan: Annotation<Plan>({ reducer: (_, n) => n, default: () => null as any }),
  patch: Annotation<Patch>({ reducer: (_, n) => n, default: () => null as any }),
  sandboxPath: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),

  // Salida de cada paso (para audit, no para tomar decisiones internas)
  statusOutput: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  diffSummary: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  conflictReport: Annotation<ConflictReport | null>({ reducer: (_, n) => n, default: () => null }),
  mergeResult: Annotation<{ succeeded: boolean; commitHash?: string } | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  tagCreated: Annotation<{ tagName: string; commitHash: string } | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),
  ticketClosed: Annotation<boolean>({ reducer: (_, n) => n, default: () => false }),

  // Escalación
  escalationReason: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
});

interface ConflictReport {
  hasConflicts: boolean;
  files: string[];
  resolvable: boolean; // ¿puede resolverse automáticamente (ours/theirs)?
  resolution?: "ours" | "theirs" | "manual";
}
```

---

## 2. El grafo: lineal, sin condicionales internos (solo fail-fast)

```ts
// src/workflows/merge-manager/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { MergeManagerState } from "./state";

const builder = new StateGraph(MergeManagerState)
  .addNode("git_status", gitStatusNode)
  .addNode("git_diff", gitDiffNode)
  .addNode("detect_conflicts", detectConflictsNode)
  .addNode("resolve_conflicts", resolveConflictsNode)
  .addNode("git_merge", gitMergeNode)
  .addNode("git_tag", gitTagNode)
  .addNode("close_ticket", closeTicketNode)
  .addNode("escalate", escalateNode)

  // Flujo: cada paso avanza al siguiente SALVO detect_conflicts, que puede
  // escalar o continuar
  .addEdge("__start__", "git_status")
  .addEdge("git_status", "git_diff")
  .addEdge("git_diff", "detect_conflicts")
  .addConditionalEdges("detect_conflicts", routeConflicts, {
    no_conflicts: "git_merge",
    resolvable: "resolve_conflicts",
    unresolvable: "escalate",
  })
  .addEdge("resolve_conflicts", "git_merge")
  .addEdge("git_merge", "git_tag")
  .addEdge("git_tag", "close_ticket")
  .addEdge("close_ticket", END)
  .addEdge("escalate", END);

export const mergeManagerWorkflow = builder.compile();
```

```ts
function routeConflicts(state: typeof MergeManagerState.State) {
  if (!state.conflictReport?.hasConflicts) return "no_conflicts";
  if (state.conflictReport.resolvable) return "resolvable";
  return "unresolvable";
}
```

Nota de diseño: hay solo **un** conditional edge — en la detección de conflictos. El resto es una secuencia lineal. Esto mantiene la máquina de estados predecible y fácil de auditar.

---

## 3. Los nodos: automatización pura de Git

```ts
// src/workflows/merge-manager/nodes/gitStatus.ts
import { runCommand } from "../../../tools/exec";

export async function gitStatusNode(state: typeof MergeManagerState.State) {
  const { stdout } = await runCommand("git status", { cwd: state.sandboxPath });
  return { statusOutput: stdout };
}
```

```ts
// src/workflows/merge-manager/nodes/gitDiff.ts
export async function gitDiffNode(state: typeof MergeManagerState.State) {
  // Diffsummary: stat de los cambios, no el diff completo
  const { stdout } = await runCommand("git diff --stat origin/main..HEAD", {
    cwd: state.sandboxPath,
  });
  return { diffSummary: stdout };
}
```

```ts
// src/workflows/merge-manager/nodes/detectConflicts.ts
export async function detectConflictsNode(state: typeof MergeManagerState.State) {
  const targetBranch = state.config.mergeManager.targetBranch; // config §5

  // Simular el merge para detectar conflictos sin aplicarlos
  const { exitCode, stdout } = await runCommand(
    `git merge --no-commit --no-ff origin/${targetBranch}`,
    { cwd: state.sandboxPath }
  );

  if (exitCode === 0) {
    // Sin conflictos, revert la simulación (el merge real viene después)
    await runCommand("git merge --abort", { cwd: state.sandboxPath });
    return { conflictReport: { hasConflicts: false, files: [], resolvable: false } };
  }

  // Hay conflictos: analiza si son resolubles automáticamente
  // (ej. solo cambios en el mismo archivo en líneas distintas, JSON merge tools)
  const { stdout: conflictFiles } = await runCommand(
    "git diff --name-only --diff-filter=U",
    { cwd: state.sandboxPath }
  );

  const files = conflictFiles.trim().split("\n").filter(Boolean);
  const resolvable = checkIfAutoresolvable(files, state.config);

  await runCommand("git merge --abort", { cwd: state.sandboxPath });

  return {
    conflictReport: { hasConflicts: true, files, resolvable, resolution: "manual" },
  };
}

function checkIfAutoresolvable(files: string[], config: any): boolean {
  // Heurística simple: si todos los conflictos están en archivos que YA
  // pasaron por la pipeline completa (impl+validation+quality), y en líneas
  // que el patch no tocó, probablemente sea seguro resolver automáticamente.
  // En caso de duda: false -> escalate.
  return false; // política conservadora: siempre escala conflictos de verdad
}
```

```ts
// src/workflows/merge-manager/nodes/resolveConflicts.ts
export async function resolveConflictsNode(state: typeof MergeManagerState.State) {
  // Solo llega aquí si checkIfAutoresolvable() fue true (ver arriba).
  // En la práctica, la política es conservadora así que casi nunca corre.
  const { resolution } = state.conflictReport!;
  const targetBranch = state.config.mergeManager.targetBranch;

  // Preparar merge nuevamente (ya hicimos abort arriba)
  await runCommand(`git merge origin/${targetBranch} --no-commit`, {
    cwd: state.sandboxPath,
  });

  if (resolution === "ours") {
    for (const file of state.conflictReport!.files) {
      await runCommand(`git checkout --ours ${file}`, { cwd: state.sandboxPath });
    }
  } else if (resolution === "theirs") {
    for (const file of state.conflictReport!.files) {
      await runCommand(`git checkout --theirs ${file}`, { cwd: state.sandboxPath });
    }
  }
  // "manual" nunca llega aquí porque routeConflicts lo escala

  return { conflictReport: { ...state.conflictReport!, resolution } };
}
```

```ts
// src/workflows/merge-manager/nodes/gitMerge.ts
export async function gitMergeNode(state: typeof MergeManagerState.State) {
  const targetBranch = state.config.mergeManager.targetBranch;
  const mergeMessage = buildMergeMessage(state.ticket, state.plan);

  // Si resolvimos conflictos, ya estamos en --no-commit; si no, es la primera vez
  let { exitCode, stderr } = await runCommand(
    `git merge origin/${targetBranch} --no-edit -m "${mergeMessage}"`,
    { cwd: state.sandboxPath }
  );

  if (exitCode !== 0) {
    return {
      mergeResult: { succeeded: false },
      escalationReason: `Merge falló: ${stderr}`,
    };
  }

  const { stdout: commitHash } = await runCommand("git rev-parse HEAD", {
    cwd: state.sandboxPath,
  });

  return { mergeResult: { succeeded: true, commitHash: commitHash.trim() } };
}

function buildMergeMessage(ticket: Ticket, plan: Plan): string {
  return `Merge ${ticket.id}: ${ticket.title}\n\n` +
    `Plan: ${plan.tasks.map((t) => t.description).join("; ")}\n` +
    `Cierre automático por Orchestrator.`;
}
```

```ts
// src/workflows/merge-manager/nodes/gitTag.ts
export async function gitTagNode(state: typeof MergeManagerState.State) {
  if (!state.mergeResult?.succeeded) return { tagCreated: null }; // fail-fast

  const tagName = buildTagName(state.ticket, state.config);
  const { stdout } = await runCommand("git rev-parse HEAD", { cwd: state.sandboxPath });
  const commitHash = stdout.trim();

  const { exitCode } = await runCommand(
    `git tag -a ${tagName} -m "Auto-merged: ${state.ticket.id}"`,
    { cwd: state.sandboxPath }
  );

  if (exitCode !== 0) {
    return {
      tagCreated: null,
      escalationReason: `Fallo al crear tag ${tagName}`,
    };
  }

  return { tagCreated: { tagName, commitHash } };
}

function buildTagName(ticket: Ticket, config: any): string {
  const strategy = config.mergeManager.tagNamingStrategy; // "semver" | "auto-increment" | custom
  if (strategy === "semver") {
    // Lee el último tag, incrementa el patch, y crea uno nuevo
    // (detalles omitidos por brevedad)
  }
  return `ticket-${ticket.id}`;
}
```

```ts
// src/workflows/merge-manager/nodes/closeTicket.ts
import { closeIssueInTracker } from "../../../tools/ticketing";

export async function closeTicketNode(state: typeof MergeManagerState.State) {
  const { ticket, mergeResult, tagCreated } = state;
  if (!mergeResult?.succeeded) return { ticketClosed: false }; // fail-fast

  // Notifica al sistema de tracking (Jira, GitHub, Linear, etc.)
  const result = await closeIssueInTracker(ticket.id, {
    mergeCommit: mergeResult.commitHash,
    tag: tagCreated?.tagName,
    closedBy: "Orchestrator/Merge Manager",
    timestamp: new Date().toISOString(),
  });

  return { ticketClosed: result.success };
}
```

```ts
// src/workflows/merge-manager/nodes/escalate.ts
export async function escalateNode(state: typeof MergeManagerState.State) {
  // Crea un reporte para humano y entra en una cola de revisión manual
  const escalationData = {
    ticket: state.ticket,
    reason: state.escalationReason ?? "Conflictos irresolubles",
    conflictFiles: state.conflictReport?.files ?? [],
    diffSummary: state.diffSummary,
    suggestedResolution: "Revisar conflictos manualmente en GitHub/Jira y resolverlos",
  };

  await notifyOperations(escalationData); // Slack, PagerDuty, etc.

  return { escalationReason: escalationData.reason };
}
```

---

## 4. Config

```yaml
# config/merge-manager.yml
mergeManager:
  targetBranch: "main"             # rama destino del merge
  requireApprovalFor:              # si está protegida
    branches: ["main", "production"]
    roles: ["engineering_lead"]
  tagNamingStrategy: "auto-increment" # o "semver" o custom
  ticketTrackerAPI:
    type: "github"                  # o "jira", "linear", etc.
    endpoint: "https://api.github.com"
    token: "${GITHUB_TOKEN}"
  autoResolvableFiles: []            # archivos donde es SEGURO auto-resolver "ours"
```

---

## 5. Gobernanza: permisos acotados y auditoria

```markdown
<!-- .harness/governance/merge-manager.md -->
# Gobernanza del Merge Manager

- El Merge Manager corre con permisos **push limitados**:
  - Puede crear branches temporales y tagear
  - NO puede forzar push a ramas protegidas (`--force` jamás)
  - NO puede borrar branches ni tags sin confirmación
- Conflictos detectados **siempre escalan** a humano, nunca se resuelven
  automáticamente — la política es conservadora (mejor escalar tarde que
  mergear conflictos sin revisar).
- Merge a ramas protegidas (main, production) requiere permisos de rol
  (`requireApprovalFor` en config). El Merge Manager tiene rol limitado;
  ramificaciones de alto riesgo requieren workflow aparte.
- Todo merge genera un tag siguiendo `tagNamingStrategy` — permite rastrear
  exactamente qué tickets ya están en producción.
- Cierre de ticket ocurre SOLO después de merge + tag exitosos — no invierte
  ese orden nunca.
```

---

## 6. Integración con el Orchestrator: el ciclo completo cierra

```ts
// En src/orchestrator/graph.ts, el nodo final ya casi completo:
.addNode("merge_manager", mergeManagerWorkflow)
.addEdge("quality_gate", "merge_manager")  // solo si verdict !== "blocking"
.addConditionalEdges("merge_manager", routeAfterMergeManager, {
  success: "select_next_ticket",   // ticket cerrado, siguiente
  escalation: "human_review",      // falta escalación manual de conflictos
})
.addNode("human_review", humanReviewNode) // espera aprobación/resolución
.addEdge("human_review", "select_next_ticket");
```

```ts
function routeAfterMergeManager(state: typeof OrchestratorState.State) {
  if (state.mergeManager.ticketClosed) return "success";
  return "escalation";
}
```

El flujo de un ticket completo ahora es:

```
backlog → select_next_ticket → knowledge_engine → planning
→ implementation → validation_pipeline
→ recovery (si falló en Capa 5) ↔ quality_gate (si pasó)
→ merge_manager (si Quality Gate dice "clear" o "advisory_only")
→ siguiente ticket
```

---

## 7. Cierre del ciclo: de la arquitectura original al código ejecutable

Resumiendo las 8 capas y cómo se conectan:

| Capa | Patrón | Entrada | Salida | Decisiones |
|---|---|---|---|---|
| 1 — Orchestrator | State machine con checkpointer | backlog | ticket current + strategy | continuar / reintentar / cambiar modelo / parar |
| 2 — Knowledge Engine | Explore–narrow loop | ticket | confirmedEvidence | suficiente / más búsquedas / escalar |
| 3 — Planner | Plan–execute–verify loop | evidencia | plan + tasks | plan válido / revisar plan / revisar discovery |
| 4 — Implementation | Patrón dinámico (test/compile/retry) | task | patch en sandbox | listo para validar / reintentar |
| 5 — Validation Pipeline | Determinístico fail-fast | patch | veredicto + evidence | pass / fail categorizado |
| 6 — Recovery | Diagnóstico + estrategia | failure + history | strategy + fix task | retry / cambiar contexto / cambiar modelo / abort |
| 7 — Quality Gate | Review-driven (4 checks nuevos) | patch post-Capa5 | issues + verdict | clear / advisory_only / blocking |
| 8 — Merge Manager | Determinístico lineal | ticket listo | merge + tag + close | success / escalate |

Todos los datos de entrada y salida están **tipados y auditables** (los `state` de LangGraph), todos los loops tienen **memoria durable** (`checkpointer` para el Orchestrator, `recoveryHistory` para Recovery, `triedQueries` para Knowledge Engine), y todos tienen **reglas de gobernanza explícitas** en `.harness/governance/*.md`.

Tu diseño original de 5 componentes inteligentes mapea casi exacto a estas 8 capas:
- **Orchestrator** ← Capa 1
- **Knowledge Engine** ← Capa 2
- **Planner** ← Capa 3
- **Implementation Loop** ← Capa 4 (+ Capa 5, que es su validation acotada)
- **Recovery & Quality Loop** ← Capa 6 + 7 (aunque decidimos separarlas para claridad)
- **Merge Manager** ← Capa 8 (no en tu lista original de 5, pero necesaria para cerrar)

---

## 8. Lanzamiento y pruebas de integración

Con todas las 8 capas en código, el siguiente paso es:

1. **Pruebas end-to-end por capa**: Orchestrator → Knowledge Engine → cierre completo del ticket (todas las capas conectadas).
2. **Tuning de presupuestos**: ajustar `maxIterations`, `tokenBudget`, etc. según dados reales de corridas de prueba.
3. **Gobernanza real**: versionar `.harness/rules/*.md`, `.harness/governance/*.md` y hacer que cambios ahí triggeren reruns en modo "dry-run" antes de permitir cambios a la lógica de decisión.
4. **Observabilidad**: conectar LangSmith (LangGraph's built-in tracing) para ver cada nodo, tiempo, tokens, y decisiones de cada corrida — es cómo entiendes dónde se pasa tiempo y dólar.

¿Esto cierra la arquitectura completa que diseñaste, o falta algo?
