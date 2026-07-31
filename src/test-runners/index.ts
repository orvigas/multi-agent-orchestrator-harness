import { TestRunnerRegistry } from "./TestRunnerRegistry.js";
import { JavaTestRunner } from "./JavaTestRunner.js";
import type { LanguageTestRunner } from "./LanguageTestRunner.js";

export * from "./LanguageTestRunner.js";
export { TestRunnerRegistry } from "./TestRunnerRegistry.js";
export { JavaTestRunner } from "./JavaTestRunner.js";

// Built-in test runners
const BUILTIN_TEST_RUNNERS: LanguageTestRunner[] = [new JavaTestRunner()];

export function initializeTestRunners(): void {
  for (const runner of BUILTIN_TEST_RUNNERS) {
    TestRunnerRegistry.register(runner);
  }
}
