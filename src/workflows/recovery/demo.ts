import { recoveryWorkflow } from "./graph.js";
import type { RecoveryEntry } from "./types.js";
import type { StageResult } from "../validation-pipeline/types.js";

const failedTask = { id: "task-1", description: "Actualizar src/foo.ts", touchesFiles: ["src/foo.ts"] };

function printResult(label: string, result: Awaited<ReturnType<typeof recoveryWorkflow.invoke>>) {
  console.log(`\n=== ${label} ===`);
  console.log(`Diagnóstico: rootCause=${result.diagnosis?.rootCause} confidence=${result.diagnosis?.confidence} isRepeatedFailure=${result.diagnosis?.isRepeatedFailure}`);
  console.log(`Estrategia: ${result.strategy}`);
  if (result.targetedFixTask) {
    console.log(
      `Fix task: "${result.targetedFixTask.description}" [touchesFiles: ${result.targetedFixTask.touchesFiles.join(", ")}]`
    );
  }
}

const testsEvidence: StageResult[] = [
  { stage: "tests", passed: false, durationMs: 42, exitCode: 1, evidence: "AssertionError: expected 2 to equal 3" },
];

// Escenario 1: fallo nuevo de Tests -> retry con una fix task real y acotada.
const first = await recoveryWorkflow.invoke({
  failureCategory: "Tests",
  validationEvidence: testsEvidence,
  failedTask,
  recoveryIteration: 0,
  maxRecoveryIterations: 3,
});
printResult("Escenario 1: fallo nuevo de Tests", first);

// Escenario 2: el MISMO fallo otra vez, con recoveryHistory ya poblado por
// el intento anterior -> isRepeatedFailure fuerza change_model (Tests no es
// Architecture/Dependencies).
const priorEntry: RecoveryEntry = {
  iteration: 1,
  diagnosis: first.diagnosis!,
  strategyChosen: first.strategy,
};
const second = await recoveryWorkflow.invoke({
  failureCategory: "Tests",
  validationEvidence: testsEvidence,
  failedTask,
  recoveryHistory: [priorEntry],
  recoveryIteration: 1,
  maxRecoveryIterations: 3,
});
printResult("Escenario 2: el mismo fallo, segunda vez (recoveryHistory poblado)", second);

// Escenario 3: Security siempre escala, sin importar presupuesto restante.
const third = await recoveryWorkflow.invoke({
  failureCategory: "Security",
  validationEvidence: [
    { stage: "security", passed: false, durationMs: 10, exitCode: 1, evidence: "high severity vulnerability found" },
  ],
  failedTask,
  recoveryIteration: 0,
  maxRecoveryIterations: 3,
});
printResult("Escenario 3: fallo de Security (siempre abort)", third);

// Escenario 4: fallo de Compilation cuya evidencia menciona una ruta
// prohibida real -> se reclasifica a Architecture.
const fourth = await recoveryWorkflow.invoke({
  failureCategory: "Compilation",
  validationEvidence: [
    {
      stage: "compile",
      passed: false,
      durationMs: 5,
      exitCode: 2,
      evidence: "error TS2307: Cannot find module 'secrets/config' or its corresponding type declarations.",
    },
  ],
  failedTask,
  recoveryIteration: 0,
  maxRecoveryIterations: 3,
});
printResult("Escenario 4: Compilation con ruta prohibida en la evidencia (reclasifica a Architecture)", fourth);
