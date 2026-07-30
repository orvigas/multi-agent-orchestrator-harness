import { STAGE_TO_FAILURE_CATEGORY } from "../types.js";
import type { ValidationStateType } from "../state.js";

export function assembleVerdictNode(state: ValidationStateType) {
  const failed = state.results.find((r) => !r.passed);
  if (!failed) return { verdict: "pass" as const };

  return {
    verdict: "fail" as const,
    failureCategory: STAGE_TO_FAILURE_CATEGORY[failed.stage],
  };
}
