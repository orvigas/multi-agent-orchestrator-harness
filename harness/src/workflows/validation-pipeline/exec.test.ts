import { test } from "node:test";
import assert from "node:assert/strict";
import { runCommand, truncate } from "./tools/exec.js";

test("runCommand: executes a real shell command and captures real stdout/exit code", async () => {
  const result = await runCommand("echo hello-from-real-command", { cwd: process.cwd(), timeoutMs: 5000 });
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes("hello-from-real-command"));
  assert.equal(result.timedOut, false);
});

test("runCommand: reports a non-zero exit code for a real failing command", async () => {
  const result = await runCommand("exit 3", { cwd: process.cwd(), timeoutMs: 5000 });
  assert.equal(result.exitCode, 3);
  assert.equal(result.timedOut, false);
});

test("runCommand: reports timedOut for a command that exceeds its timeout", async () => {
  const result = await runCommand("sleep 5", { cwd: process.cwd(), timeoutMs: 200 });
  assert.equal(result.timedOut, true);
  assert.equal(result.exitCode, 124);
});

test("runCommand: two independent commands actually overlap in wall-clock time", async () => {
  const start = Date.now();
  await Promise.all([
    runCommand("sleep 0.3", { cwd: process.cwd(), timeoutMs: 5000 }),
    runCommand("sleep 0.3", { cwd: process.cwd(), timeoutMs: 5000 }),
  ]);
  const elapsed = Date.now() - start;
  // Si estuvieran serializadas (spawnSync bloqueante) esto tomaría >=600ms;
  // en paralelo real debería tomar bastante menos que la suma de ambas.
  assert.ok(elapsed < 550, `esperaba que ambos comandos corrieran en paralelo, tomó ${elapsed}ms`);
});

test("truncate: leaves short text untouched", () => {
  assert.equal(truncate("short", 100), "short");
});

test("truncate: cuts long text and marks it as truncated", () => {
  const long = "x".repeat(200);
  const out = truncate(long, 50);
  assert.ok(out.length < long.length);
  assert.ok(out.endsWith("(truncado)"));
});
