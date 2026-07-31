export interface TestFailure {
  file: string;
  testName: string;
  message: string;
  stackTrace: string;
}

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
  };
}

export interface TestOptions {
  timeout?: number;
  grep?: string;
  coverage?: boolean;
}

export interface CoverageReport {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  files: Record<string, number>;
}

export interface LanguageTestRunner {
  language: string;

  /**
   * Detect test files for this language.
   */
  findTestFiles(rootPath: string): string[];

  /**
   * Run tests and return results.
   */
  runTests(rootPath: string, options?: TestOptions): TestResult;

  /**
   * Extract code coverage.
   */
  getCoverage(rootPath: string): CoverageReport;
}
