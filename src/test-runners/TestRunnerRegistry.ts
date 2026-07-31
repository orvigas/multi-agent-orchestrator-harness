import type { LanguageTestRunner } from "./LanguageTestRunner.js";

export class TestRunnerRegistry {
  private static runners: Map<string, LanguageTestRunner> = new Map();

  static register(runner: LanguageTestRunner): void {
    TestRunnerRegistry.runners.set(runner.language, runner);
  }

  static getTestRunner(language: string): LanguageTestRunner {
    const runner = TestRunnerRegistry.runners.get(language);
    if (!runner) {
      throw new Error(`No test runner found for language: ${language}`);
    }
    return runner;
  }

  static hasTestRunner(language: string): boolean {
    return TestRunnerRegistry.runners.has(language);
  }

  static supportedLanguages(): string[] {
    return Array.from(TestRunnerRegistry.runners.keys());
  }
}
