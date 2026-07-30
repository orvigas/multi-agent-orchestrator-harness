import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createSandbox, cleanupSandbox, applyPatch } from "./sandbox.js";
import type { Patch } from "../types.js";

test("sandbox: create and cleanup filesystem sandbox", () => {
  // Create a simple test project in temp dir
  const testProjectRoot = path.join(process.cwd(), "src/workflows/implementation/tools");

  const sandbox = createSandbox("test-task-1", testProjectRoot);

  assert.ok(sandbox.path, "Sandbox path should be set");
  assert.equal(sandbox.type, "filesystem", "Should be filesystem type (Docker not available in tests)");
  assert.equal(sandbox.taskId, "test-task-1", "TaskId should match");
  assert.equal(sandbox.projectRoot, testProjectRoot, "ProjectRoot should match");

  assert.ok(fs.existsSync(sandbox.path), "Sandbox directory should exist");

  cleanupSandbox(sandbox);
  assert.ok(!fs.existsSync(sandbox.path), "Sandbox directory should be removed after cleanup");
});

test("sandbox: cleanup backward compatibility with string path", () => {
  const testProjectRoot = process.cwd();
  const sandbox = createSandbox("test-task-2", testProjectRoot);

  assert.ok(fs.existsSync(sandbox.path), "Sandbox should exist before cleanup");

  // Test backward compatibility: pass string path
  cleanupSandbox(sandbox.path);
  assert.ok(!fs.existsSync(sandbox.path), "Sandbox should be cleaned up with string path");
});

test("sandbox: apply simple patch", () => {
  const testProjectRoot = process.cwd();
  const sandbox = createSandbox("test-task-3", testProjectRoot);

  // Create a test file in sandbox
  const testFile = path.join(sandbox.path, "test.txt");
  fs.writeFileSync(testFile, "line 1\nline 2\nline 3\nline 4\n");

  // Apply a patch that replaces line 2 and 3
  const patch: Patch = {
    taskId: "test-task-3",
    rationale: "Test patch modification",
    hunks: [
      {
        file: "test.txt",
        contextBefore: ["line 1"],
        oldLines: ["line 2", "line 3"],
        newLines: ["modified line 2", "modified line 3"],
        contextAfter: ["line 4"],
      },
    ],
  };

  const result = applyPatch(sandbox.path, patch);

  assert.ok(result.applied, "Patch should be applied successfully");
  const content = fs.readFileSync(testFile, "utf8");
  assert.ok(content.includes("modified line 2"), "Modified line 2 should exist");
  assert.ok(content.includes("modified line 3"), "Modified line 3 should exist");

  cleanupSandbox(sandbox);
});

test("sandbox: detect conflict in dry-run mode", () => {
  const testProjectRoot = process.cwd();
  const sandbox = createSandbox("test-task-4", testProjectRoot);

  // Create a test file in sandbox
  const testFile = path.join(sandbox.path, "test.txt");
  fs.writeFileSync(testFile, "line 1\nline 2\nline 3\nline 4\n");

  // Try to apply a patch with mismatched context
  const patch: Patch = {
    taskId: "test-task-4",
    rationale: "Test conflict detection",
    hunks: [
      {
        file: "test.txt",
        contextBefore: ["wrong context"],
        oldLines: ["line 2", "line 3"],
        newLines: ["modified line 2", "modified line 3"],
        contextAfter: ["line 4"],
      },
    ],
  };

  const result = applyPatch(sandbox.path, patch, { dryRun: true });

  assert.ok(!result.applied, "Dry-run should detect conflict");
  assert.ok(result.conflictingFiles?.includes("test.txt"), "Should report conflicting file");

  // Verify file was not modified
  const content = fs.readFileSync(testFile, "utf8");
  assert.ok(!content.includes("modified"), "File should not be modified in dry-run");

  cleanupSandbox(sandbox);
});

test("sandbox: handle missing file gracefully", () => {
  const testProjectRoot = process.cwd();
  const sandbox = createSandbox("test-task-5", testProjectRoot);

  // Try to apply patch to non-existent file
  const patch: Patch = {
    taskId: "test-task-5",
    rationale: "Test missing file handling",
    hunks: [
      {
        file: "nonexistent.txt",
        contextBefore: [],
        oldLines: ["old"],
        newLines: ["new"],
        contextAfter: [],
      },
    ],
  };

  const result = applyPatch(sandbox.path, patch);

  assert.ok(!result.applied, "Should fail when file doesn't exist");
  assert.ok(result.detail.includes("no encontrado"), "Should mention file not found");

  cleanupSandbox(sandbox);
});

test("sandbox: handle empty patch", () => {
  const testProjectRoot = process.cwd();
  const sandbox = createSandbox("test-task-6", testProjectRoot);

  const patch: Patch = { taskId: "test-task-6", rationale: "Test empty patch", hunks: [] };
  const result = applyPatch(sandbox.path, patch);

  assert.ok(result.applied, "Empty patch should be treated as success");
  assert.ok(result.detail.includes("vacío"), "Should mention empty patch");

  cleanupSandbox(sandbox);
});
