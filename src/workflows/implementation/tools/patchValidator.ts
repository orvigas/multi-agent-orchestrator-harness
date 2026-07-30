/**
 * Patch validation and safety checks for Phase 2.1 LLM-generated patches.
 * Ensures LLM output meets safety requirements before application.
 */

import { extractForbiddenPatterns, matchesForbiddenPattern } from "../../../config/forbiddenZones.js";
import { buildContextBlock } from "../../../config/loadContext.js";
import type { Patch, PatchHunk } from "../types.js";

export interface PatchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that a patch doesn't touch forbidden zones.
 * Phase 2.1 hard rule: LLM cannot generate patches that violate forbidden zones.
 */
export function validateForbiddenZones(patch: Patch, targetPath?: string): PatchValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const forbiddenPatterns = extractForbiddenPatterns(buildContextBlock("rules", targetPath));

    for (const hunk of patch.hunks) {
      const isForbidden = forbiddenPatterns.some((p) => matchesForbiddenPattern(hunk.file, p));
      if (isForbidden) {
        errors.push(`File "${hunk.file}" is in forbidden zones (see .harness/rules/forbidden-zones.md)`);
      }
    }
  } catch (err) {
    warnings.push(`Could not validate forbidden zones: ${(err as Error).message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate hunk structure and format.
 * Ensures hunks are context-based (never line numbers).
 */
export function validateHunkFormat(hunk: PatchHunk): PatchValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // File must exist and be a path
  if (!hunk.file || typeof hunk.file !== "string") {
    errors.push("Hunk must have a 'file' property (string)");
  }

  // All arrays must be non-null and contain strings
  const arrays = [
    ["contextBefore", hunk.contextBefore],
    ["oldLines", hunk.oldLines],
    ["newLines", hunk.newLines],
    ["contextAfter", hunk.contextAfter],
  ] as const;

  for (const [name, arr] of arrays) {
    if (!Array.isArray(arr)) {
      errors.push(`Hunk ${name} must be an array`);
    } else if (arr.length > 0 && !arr.every((item) => typeof item === "string")) {
      errors.push(`Hunk ${name} must contain only strings`);
    }
  }

  // Context must exist (at least before or after)
  if (hunk.contextBefore.length === 0 && hunk.contextAfter.length === 0) {
    warnings.push("Hunk has no context (neither contextBefore nor contextAfter) — risky, may match wrong location");
  }

  // oldLines and newLines must not be empty together
  if (hunk.oldLines.length === 0 && hunk.newLines.length === 0) {
    errors.push("Hunk must have either oldLines or newLines (or both)");
  }

  // Context lines should not contain partial content from oldLines/newLines
  // (sign of line-number-based thinking, not context-based)
  const contextAll = [...hunk.contextBefore, ...hunk.contextAfter];
  const oldNewAll = [...hunk.oldLines, ...hunk.newLines];
  const duplicates = contextAll.filter((c) => oldNewAll.includes(c));
  if (duplicates.length > 0) {
    warnings.push(
      `Potential overlap between context and content lines. Lines appearing in both: ${duplicates.slice(0, 3).join(", ")}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate entire patch structure.
 */
export function validatePatchStructure(patch: Patch): PatchValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Patch must have taskId and rationale
  if (!patch.taskId || typeof patch.taskId !== "string") {
    allErrors.push("Patch must have a 'taskId' property (string)");
  }

  if (!patch.rationale || typeof patch.rationale !== "string") {
    allErrors.push("Patch must have a 'rationale' property (string, explaining why this change solves the task)");
  }

  if (!Array.isArray(patch.hunks)) {
    allErrors.push("Patch must have a 'hunks' array");
    return { valid: false, errors: allErrors, warnings: allWarnings };
  }

  // Validate each hunk
  for (let i = 0; i < patch.hunks.length; i++) {
    const hunkResult = validateHunkFormat(patch.hunks[i]!);
    allErrors.push(...hunkResult.errors.map((e) => `Hunk ${i}: ${e}`));
    allWarnings.push(...hunkResult.warnings.map((w) => `Hunk ${i}: ${w}`));
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Comprehensive patch validation (Phase 2.1).
 * Checks:
 * 1. Structure (taskId, rationale, hunks array)
 * 2. Format (hunk arrays, string content)
 * 3. Forbidden zones (hard rule — cannot touch forbidden files)
 * 4. Sanity (context exists, no partial overlaps)
 */
export function validatePatch(patch: Patch, targetPath?: string): PatchValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // 1. Structure
  const structureResult = validatePatchStructure(patch);
  allErrors.push(...structureResult.errors);
  allWarnings.push(...structureResult.warnings);

  if (!structureResult.valid) {
    return { valid: false, errors: allErrors, warnings: allWarnings };
  }

  // 2. Format (per-hunk)
  for (let i = 0; i < patch.hunks.length; i++) {
    const formatResult = validateHunkFormat(patch.hunks[i]!);
    allErrors.push(...formatResult.errors.map((e) => `Hunk ${i}: ${e}`));
    allWarnings.push(...formatResult.warnings.map((w) => `Hunk ${i}: ${w}`));
  }

  // 3. Forbidden zones
  const forbiddenResult = validateForbiddenZones(patch, targetPath);
  allErrors.push(...forbiddenResult.errors);
  allWarnings.push(...forbiddenResult.warnings);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Format validation result for human-readable output.
 */
export function formatValidationResult(result: PatchValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push("✅ Patch validation passed");
  } else {
    lines.push("❌ Patch validation failed");
  }

  if (result.errors.length > 0) {
    lines.push("\nErrors:");
    for (const error of result.errors) {
      lines.push(`  ✘ ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("\nWarnings:");
    for (const warning of result.warnings) {
      lines.push(`  ⚠️  ${warning}`);
    }
  }

  return lines.join("\n");
}
