import { TestRunnerRegistry } from "./TestRunnerRegistry.js";
import type { LanguageTestRunner } from "./LanguageTestRunner.js";

export * from "./LanguageTestRunner.js";
export { TestRunnerRegistry } from "./TestRunnerRegistry.js";

// Built-in test runners would go here
// For now, they are registered as needed
const BUILTIN_TEST_RUNNERS: LanguageTestRunner[] = [];

export function initializeTestRunners(): void {
  for (const runner of BUILTIN_TEST_RUNNERS) {
    TestRunnerRegistry.register(runner);
  }
}
