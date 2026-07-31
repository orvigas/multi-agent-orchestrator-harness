import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveExecutionPlan } from "./implementation.js";
import type { Plan, PlanTask } from "../../workflows/planner/types.js";

function makeTask(id: string): PlanTask {
  return { id, description: `original ${id}`, touchesFiles: [`src/${id}.ts`] };
}

const plan: Plan = {
  tasks: [makeTask("task-1"), makeTask("task-2"), makeTask("task-3")],
  order: ["task-1", "task-2", "task-3"],
  dependencies: {},
};

test("resolveExecutionPlan: with no prior failure, runs the whole plan from the start", () => {
  const result = resolveExecutionPlan(plan, null, null);
  assert.deepEqual(
    result.map((r) => r.taskId),
    ["task-1", "task-2", "task-3"]
  );
  assert.equal(result[0].task.description, "original task-1");
});

test("resolveExecutionPlan: resumes at the failed task, skipping already-completed earlier tasks", () => {
  const result = resolveExecutionPlan(plan, "task-2", null);
  assert.deepEqual(
    result.map((r) => r.taskId),
    ["task-2", "task-3"]
  );
});

test("resolveExecutionPlan: substitutes the targeted fix task ONLY at the failed position, leaving later tasks untouched", () => {
  const fixTask: PlanTask = { id: "fix-123", description: "narrow fix", touchesFiles: ["src/task-2.ts"] };
  const result = resolveExecutionPlan(plan, "task-2", fixTask);

  assert.equal(result.length, 2);
  assert.equal(result[0].taskId, "task-2"); // el id de reanudación sigue siendo el ORIGINAL
  assert.equal(result[0].task.id, "fix-123"); // pero la task ejecutada es la fix task
  assert.equal(result[0].task.description, "narrow fix");
  assert.equal(result[1].taskId, "task-3");
  assert.equal(result[1].task.description, "original task-3"); // no sustituida
});

test("resolveExecutionPlan: a second failure of the same task still resolves to the correct position", () => {
  // Simula: task-2 falló, Recovery preparó fix-1 (que también falló),
  // Recovery preparó fix-2 -- failedTaskId sigue siendo "task-2" en ambas
  // rondas, nunca el id sintético de la fix task.
  const fixTask2: PlanTask = { id: "fix-456", description: "second narrow fix", touchesFiles: ["src/task-2.ts"] };
  const result = resolveExecutionPlan(plan, "task-2", fixTask2);
  assert.equal(result[0].task.id, "fix-456");
  assert.deepEqual(
    result.map((r) => r.taskId),
    ["task-2", "task-3"]
  );
});

test("resolveExecutionPlan: skips a task id that no longer exists in plan.tasks", () => {
  const planWithGap: Plan = { ...plan, order: ["task-1", "ghost-task", "task-3"] };
  const result = resolveExecutionPlan(planWithGap, null, null);
  assert.deepEqual(
    result.map((r) => r.taskId),
    ["task-1", "task-3"]
  );
});
