import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePatchStructure,
  validateHunkFormat,
  validatePatch,
  formatValidationResult,
} from "./patchValidator.js";
import type { Patch, PatchHunk } from "../types.js";

test("patchValidator: validatePatchStructure detects missing taskId", () => {
  const patch = {
    // missing taskId
    rationale: "Fix typo",
    hunks: [],
  } as unknown as Patch;

  const result = validatePatchStructure(patch);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("taskId")));
});

test("patchValidator: validatePatchStructure detects missing rationale", () => {
  const patch = {
    taskId: "task-1",
    // missing rationale
    hunks: [],
  } as unknown as Patch;

  const result = validatePatchStructure(patch);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("rationale")));
});

test("patchValidator: validatePatchStructure accepts valid structure", () => {
  const patch: Patch = {
    taskId: "task-1",
    rationale: "Fix the bug",
    hunks: [
      {
        file: "src/main.ts",
        contextBefore: ["line 1", "line 2"],
        oldLines: ["bad line"],
        newLines: ["good line"],
        contextAfter: ["line 3"],
      },
    ],
  };

  const result = validatePatchStructure(patch);
  assert.ok(result.valid);
});

test("patchValidator: validateHunkFormat detects missing file", () => {
  const hunk = {
    // missing file
    contextBefore: [],
    oldLines: ["old"],
    newLines: ["new"],
    contextAfter: [],
  } as unknown as PatchHunk;

  const result = validateHunkFormat(hunk);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("file")));
});

test("patchValidator: validateHunkFormat detects missing context", () => {
  const hunk: PatchHunk = {
    file: "test.ts",
    contextBefore: [],
    oldLines: ["old"],
    newLines: ["new"],
    contextAfter: [],
  };

  const result = validateHunkFormat(hunk);
  assert.ok(result.valid);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings[0].includes("no context"));
});

test("patchValidator: validateHunkFormat detects empty oldLines and newLines", () => {
  const hunk: PatchHunk = {
    file: "test.ts",
    contextBefore: ["line 1"],
    oldLines: [],
    newLines: [],
    contextAfter: [],
  };

  const result = validateHunkFormat(hunk);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("oldLines or newLines")));
});

test("patchValidator: validateHunkFormat detects non-string array items", () => {
  const hunk = {
    file: "test.ts",
    contextBefore: ["line 1"],
    oldLines: [123],  // number instead of string
    newLines: ["new"],
    contextAfter: [],
  } as unknown as PatchHunk;

  const result = validateHunkFormat(hunk);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("strings")));
});

test("patchValidator: validateHunkFormat accepts valid format", () => {
  const hunk: PatchHunk = {
    file: "src/app.ts",
    contextBefore: ["function foo() {", "  // TODO"],
    oldLines: ["  return 42;"],
    newLines: ["  return 43;"],
    contextAfter: ["}"],
  };

  const result = validateHunkFormat(hunk);
  assert.ok(result.valid);
  assert.equal(result.errors.length, 0);
});

test("patchValidator: validatePatch combines all checks", () => {
  const patch: Patch = {
    taskId: "task-1",
    rationale: "Add missing return statement",
    hunks: [
      {
        file: "src/utils.ts",
        contextBefore: ["function getValue() {"],
        oldLines: ["  console.log(123);"],
        newLines: ["  console.log(123);", "  return 123;"],
        contextAfter: ["}"],
      },
    ],
  };

  const result = validatePatch(patch, process.cwd());
  assert.ok(result.valid, `Validation should pass: ${result.errors.join(", ")}`);
});

test("patchValidator: formatValidationResult shows errors", () => {
  const result = {
    valid: false,
    errors: ["Missing taskId", "Invalid hunk format"],
    warnings: ["No context provided"],
  };

  const formatted = formatValidationResult(result);
  assert.ok(formatted.includes("❌"));
  assert.ok(formatted.includes("Missing taskId"));
  assert.ok(formatted.includes("Invalid hunk format"));
  assert.ok(formatted.includes("No context provided"));
});

test("patchValidator: formatValidationResult shows success", () => {
  const result = { valid: true, errors: [], warnings: [] };
  const formatted = formatValidationResult(result);

  assert.ok(formatted.includes("✅"));
  assert.ok(formatted.includes("passed"));
});

test("patchValidator: detects overlapping context and content", () => {
  const hunk: PatchHunk = {
    file: "test.ts",
    contextBefore: ["function foo() {", "  let x = 1;"],
    oldLines: ["  let x = 1;"],  // Overlaps with contextBefore
    newLines: ["  let x = 2;"],
    contextAfter: ["}"],
  };

  const result = validateHunkFormat(hunk);
  assert.ok(result.warnings.some((w) => w.includes("overlap")));
});

test("patchValidator: empty patch is valid (no hunks, but valid structure)", () => {
  const patch: Patch = {
    taskId: "task-1",
    rationale: "No changes needed",
    hunks: [],
  };

  const result = validatePatch(patch, process.cwd());
  assert.ok(result.valid);
});
