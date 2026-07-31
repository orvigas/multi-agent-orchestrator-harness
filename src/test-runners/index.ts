import { TestRunnerRegistry } from "./TestRunnerRegistry.js";
import { JavaTestRunner } from "./JavaTestRunner.js";
import { PythonTestRunner } from "./PythonTestRunner.js";
import { GoTestRunner } from "./GoTestRunner.js";
import { RustTestRunner } from "./RustTestRunner.js";
import type { LanguageTestRunner } from "./LanguageTestRunner.js";

export * from "./LanguageTestRunner.js";
export { TestRunnerRegistry } from "./TestRunnerRegistry.js";
export { JavaTestRunner } from "./JavaTestRunner.js";
export { PythonTestRunner } from "./PythonTestRunner.js";
export { GoTestRunner } from "./GoTestRunner.js";
export { RustTestRunner } from "./RustTestRunner.js";

// Built-in test runners
const BUILTIN_TEST_RUNNERS: LanguageTestRunner[] = [
  new JavaTestRunner(),
  new PythonTestRunner(),
  new GoTestRunner(),
  new RustTestRunner(),
];

export function initializeTestRunners(): void {
  for (const runner of BUILTIN_TEST_RUNNERS) {
    TestRunnerRegistry.register(runner);
  }
}
