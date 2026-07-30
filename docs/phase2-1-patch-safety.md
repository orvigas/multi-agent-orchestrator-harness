# Phase 2.1: Patch Generation with Safety Checks

**Status**: ✅ Complete
**Implementation Date**: 2026-07-30

## Overview

Phase 2.1 integrates LLM-powered patch generation (Layer 4: Implementation) with comprehensive safety validation. LLM-generated patches must pass multiple checks before being applied, ensuring code quality and preventing dangerous modifications.

## Architecture

### Patch Validation Pipeline

When `HARNESS_MODE=llm`, the patch generation flow is:

```
1. LLM generates patch (JSON)
           ↓
2. Parse JSON → Patch object
           ↓
3. Validate patch structure (taskId, rationale, hunks)
           ↓
4. Validate hunk format (arrays, strings, context)
           ↓
5. Validate forbidden zones (hard rule — reject if touched)
           ↓
6. Accept or reject patch
           ↓
    Accept: Record token events → Return to Implementation Loop
    Reject: Fall back to deterministic heuristic
```

### Safety Checks (Order Matters)

#### 1. Structure Validation

**Required fields**:
- `taskId` (string) — identifies which task this patch solves
- `rationale` (string) — human-readable explanation of the change
- `hunks` (array) — list of file modifications

**Example of structural rejection**:
```json
{
  // INVALID: missing taskId and rationale
  "hunks": [{ "file": "test.ts", ... }]
}
```
→ Rejected: `Patch must have a 'taskId' property`

#### 2. Hunk Format Validation

**Each hunk must have**:
- `file` (string) — path to file being modified
- `contextBefore` (string[]) — real lines before the change
- `oldLines` (string[]) — lines to replace
- `newLines` (string[]) — replacement lines
- `contextAfter` (string[]) — real lines after the change

**Format checks**:
- All arrays must contain only strings
- Cannot have empty `oldLines` AND empty `newLines` (nothing to change)
- Context lines should not overlap with content (sign of line-number thinking)

**Example of format rejection**:
```json
{
  "file": "app.ts",
  "contextBefore": ["function foo() {"],
  "oldLines": [123],  // ❌ Number instead of string
  "newLines": ["return 42;"],
  "contextAfter": ["}"]
}
```
→ Rejected: `Hunk oldLines must contain only strings`

#### 3. Context Requirement

**Hard rule**: Hunks MUST have context (lines surrounding the change).

This ensures:
- Patch applies at the right location (context is unique)
- LLM understands the surrounding code (not line-number thinking)
- Merge conflicts are less likely

**Example of context warning**:
```json
{
  "file": "utils.ts",
  "contextBefore": [],  // ⚠️ Empty
  "oldLines": ["function foo()"],
  "newLines": ["function bar()"],
  "contextAfter": []     // ⚠️ Empty
}
```
→ Warning: `Hunk has no context (neither contextBefore nor contextAfter) — risky`
→ Still valid, but flagged for review

#### 4. Forbidden Zones (Hard Rule)

**Phase 2.1 enforcement**: LLM cannot touch forbidden files/patterns.

From `.harness/rules/forbidden-zones.md`, the patch validator rejects any hunk that touches:
- `.*\.test\.ts` (test files — only test tooling should modify these)
- `src/orchestrator/state.ts` (critical state structure)
- `config/.*\.yml` (production configuration)
- Any path matching `.harness/rules/forbidden-zones.md` patterns

**Example of forbidden-zone rejection**:
```json
{
  "file": "src/orchestrator/state.ts",  // ❌ Forbidden!
  "contextBefore": ["export const x = 1;"],
  "oldLines": ["export const x = 1;"],
  "newLines": ["export const x = 2;"],
  "contextAfter": []
}
```
→ Rejected: `File "src/orchestrator/state.ts" is in forbidden zones`

### The patchValidator Service

**File**: `src/workflows/implementation/tools/patchValidator.ts`

Core functions:

```typescript
// Validate entire patch (structure + format + forbidden zones)
validatePatch(patch: Patch, targetPath?: string): PatchValidationResult

// Individual checks (used internally, available for custom validation)
validatePatchStructure(patch: Patch): PatchValidationResult
validateHunkFormat(hunk: PatchHunk): PatchValidationResult
validateForbiddenZones(patch: Patch, targetPath?: string): PatchValidationResult

// Format result for human output
formatValidationResult(result: PatchValidationResult): string
```

**Result interface**:

```typescript
interface PatchValidationResult {
  valid: boolean;          // Passed all checks?
  errors: string[];        // Show-stopping issues
  warnings: string[];      // Risky but allowed
}
```

## Integration with generatePatchNode

**Location**: `src/workflows/implementation/nodes/generatePatch.ts`

When LLM mode is enabled:

```typescript
if (HARNESS_MODE === "llm" && state.config) {
  // 1. Call Claude to generate patch
  const response = await callLLM({
    role: "implementer",
    systemPrompt: buildContextBlock("rules", state.targetPath),
    userPrompt: taskDescription + fileContents + format_instructions,
    temperature: 0.1,
    maxTokens: 4000,
  }, state.config);

  // 2. Parse JSON → Patch
  const patch = JSON.parse(response.content);

  // 3. Validate patch (Phase 2.1)
  const validationResult = validatePatch(patch, state.targetPath);

  if (!validationResult.valid) {
    // Rejection: log errors and fall back to heuristic
    console.error("LLM patch validation failed:\n" + formatValidationResult(validationResult));
    return finalize(state, {
      taskId: task.id,
      hunks: [],
      rationale: `LLM patch rejected: ${validationResult.errors[0]}. Falling back to heuristic.`,
    });
  }

  // 4. Log warnings if any
  if (validationResult.warnings.length > 0) {
    console.warn("LLM patch validation warnings:\n" + validationResult.warnings.join("\n"));
  }

  // 5. Record token usage (Phase 1.3) + return validated patch
  const tokenEvent = recordTokenUsage(
    "implementation",
    "patch_generation",
    `LLM-generated patch for task ${task.id} (passed safety validation)`,
    task.id,
    { hunksCount: patch.hunks.length, tokensUsed: response.totalTokens }
  );

  return {
    patch,
    tokenEvents: [tokenEvent],
    // ...
  };
}
```

### Key Behaviors

1. **Validation is always performed** — no way to bypass (Phase 2.1 hard rule)
2. **Errors reject the patch** — LLM output is discarded, falls back to heuristic
3. **Warnings log but allow** — risky patterns are visible but don't block
4. **Forbidden zones are non-negotiable** — cannot be overridden

## Testing

13 comprehensive tests in `src/workflows/implementation/tools/patchValidator.test.ts`:

```bash
npm test 2>&1 | grep patchValidator
```

Tests cover:
- Missing required fields (taskId, rationale)
- Invalid hunk format (non-strings, missing arrays)
- Context validation (no context warning, overlapping content)
- Forbidden zones detection
- Valid patch acceptance
- Result formatting

All 157 total tests pass.

## LLM Prompting Changes (Phase 2.1)

The prompt given to Claude now emphasizes:

1. **Context-based thinking** (not line numbers)
   ```
   "contextBefore": ["line that comes before the change"],
   "contextAfter": ["line that comes after the change"]
   ```

2. **Explicit context requirement**
   ```
   "CRITICAL: Each hunk MUST have both contextBefore AND contextAfter"
   ```

3. **Rationale for Quality Gate** (Layer 7)
   ```
   "rationale": "Brief explanation of why this patch solves the task"
   ```

## Fallback Behavior

If LLM-generated patch fails validation:

1. Log validation errors
2. Clear the patch (return empty hunks)
3. Add context to rationale explaining the failure
4. Continue with deterministic heuristic (TODO comment)
5. Let downstream layers (quick-check, validation) run normally
6. Recovery layer can escalate if heuristic also fails

**This prevents LLM mistakes from breaking the pipeline** — there's always a fallback.

## Token Tracking (Phase 1.3 Integration)

Valid LLM patches record token usage:

```typescript
const tokenEvent = recordTokenUsage(
  "implementation",
  "patch_generation",
  "LLM-generated patch for task T-1 (passed safety validation)",
  "T-1",
  {
    hunksCount: 2,
    filesModified: 1,
    tokensUsed: response.totalTokens,  // Real count from Claude API
  }
);
```

**What's tracked**:
- Input + output tokens from LLM call
- Number of hunks generated
- Number of files touched
- Validation result (passed all checks)

**Visible in**: `npm run harness:costs --days=1`

## Known Limitations

### Phase 2.1 (Current)

1. **Validation is strict** — any error rejects the patch
   - Reason: Safety-first for LLM-generated code
   - Upside: Prevents bad patches from reaching the codebase
   - Downside: May reject valid patches with minor formatting issues

2. **No auto-repair** — can't fix LLM mistakes
   - Reason: Complex to guess what Claude intended
   - Workaround: Recovery layer will retry with different strategy

3. **Forbidden zones are read-only** — cannot be updated without explicit override
   - Reason: These are governance decisions (compliance, safety)
   - Workaround: Update `.harness/rules/forbidden-zones.md` if zone is genuinely obsolete

### Phase 2.2 (Planned)

1. **Lenient validation mode** — warnings are converted to errors only after N retries
   - Allows LLM some "learning" before hard rejection

2. **Auto-repair for common issues** — e.g., add missing context by re-reading file
   - Only repair format, not semantics

3. **Forbidden zone override** — require human approval for specific zones
   - Audit-logged in `.harness/runs.jsonl`

## Monitoring & Debugging

### View validation results in logs

```bash
HARNESS_MODE=llm npm run dev 2>&1 | grep -A 5 "validation"
```

Output shows:
```
LLM patch validation failed:
❌ Patch validation failed
Errors:
  ✘ File "src/orchestrator/state.ts" is in forbidden zones (see .harness/rules/forbidden-zones.md)
```

### Analyze validation patterns

```bash
# Rejected patches (validation failed):
npm run dev 2>&1 | grep "LLM patch rejected" | wc -l

# Validation warnings (valid but suspicious):
npm run dev 2>&1 | grep "LLM patch validation warnings" | wc -l
```

### Test patch manually

```typescript
import { validatePatch } from "./src/workflows/implementation/tools/patchValidator.js";

const myPatch = {
  taskId: "T-1",
  rationale: "Fix the bug",
  hunks: [{ ... }]
};

const result = validatePatch(myPatch, "/path/to/repo");
console.log(result);
```

## Examples

### Valid Patch

```json
{
  "taskId": "T-1",
  "rationale": "Add missing return statement to getValue function",
  "hunks": [
    {
      "file": "src/utils.ts",
      "contextBefore": ["function getValue() {", "  console.log(123);"],
      "oldLines": ["  console.log(123);"],
      "newLines": ["  console.log(123);", "  return 123;"],
      "contextAfter": ["}"]
    }
  ]
}
```

✅ Passes all validation checks

### Invalid: Missing Context

```json
{
  "taskId": "T-2",
  "rationale": "Remove unused import",
  "hunks": [
    {
      "file": "src/main.ts",
      "contextBefore": [],
      "oldLines": ["import { unused } from './lib';"],
      "newLines": [],
      "contextAfter": []
    }
  ]
}
```

⚠️ Warning: `no context` (still valid, but risky)

### Invalid: Forbidden Zone

```json
{
  "taskId": "T-3",
  "rationale": "Update state structure",
  "hunks": [
    {
      "file": "src/orchestrator/state.ts",
      "contextBefore": ["export const x = 1;"],
      "oldLines": ["export const x = 1;"],
      "newLines": ["export const x = 2;"],
      "contextAfter": []
    }
  ]
}
```

❌ Rejected: `File "src/orchestrator/state.ts" is in forbidden zones`

## References

- **src/workflows/implementation/tools/patchValidator.ts** — Validation service
- **src/workflows/implementation/tools/patchValidator.test.ts** — 13 tests
- **src/workflows/implementation/nodes/generatePatch.ts** — Integration point
- **.harness/rules/forbidden-zones.md** — Governance rules
- **Phase 2** — LLM infrastructure (callLLM service)
- **Phase 1.3** — Token tracking (integration for token counting)
