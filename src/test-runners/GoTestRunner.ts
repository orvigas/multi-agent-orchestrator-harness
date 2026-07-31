import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import type { LanguageTestRunner, TestResult, CoverageReport, TestOptions } from "./LanguageTestRunner.js";

export class GoTestRunner implements LanguageTestRunner {
  language = "go";

  findTestFiles(rootPath: string): string[] {
    const testFiles: string[] = [];

    const findTests = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (![".git", "vendor", "bin"].some((skip) => fullPath.includes(skip))) {
              findTests(fullPath);
            }
          } else if (entry.name.endsWith("_test.go")) {
            testFiles.push(fullPath);
          }
        }
      } catch (err) {
        // Ignore read errors
      }
    };

    findTests(rootPath);
    return testFiles;
  }

  runTests(rootPath: string, options?: TestOptions): TestResult {
    const startTime = Date.now();
    const timeout = options?.timeout || 120000;

    try {
      // Run go test -v for verbose output
      const result = spawnSync("go", ["test", "-v", "./..."], {
        cwd: rootPath,
        encoding: "utf-8",
        timeout,
      });

      const output = result.stdout || "";
      const lines = output.split("\n");

      let passed = 0;
      let failed = 0;

      for (const line of lines) {
        if (line.includes("ok")) {
          passed++;
        } else if (line.includes("FAIL")) {
          failed++;
        }
      }

      const summaryMatch = output.match(/^(ok|FAIL)\s+([^\s]+)\s+([\d.]+s)/m);
      if (!summaryMatch) {
        // Try parsing test result line
        const testMatch = output.match(/ok\s+(.+?)\s+([\d.]+s)/);
        if (testMatch) {
          passed++;
        }
      }

      const duration = Date.now() - startTime;

      return {
        passed,
        failed,
        skipped: 0,
        duration,
        failures: [],
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        failures: [
          {
            file: rootPath,
            testName: "go test",
            message: `Failed to run tests: ${err}`,
            stackTrace: "",
          },
        ],
      };
    }
  }

  getCoverage(rootPath: string): CoverageReport {
    try {
      // Try to get coverage with go test -cover
      const result = spawnSync("go", ["test", "-cover", "./..."], {
        cwd: rootPath,
        encoding: "utf-8",
        timeout: 60000,
      });

      const output = result.stdout || "";

      // Parse coverage output: coverage: XX.X% of statements
      const match = output.match(/coverage:\s+([\d.]+)%/);
      const coverage = match ? parseInt(match[1]) : 0;

      return {
        lines: coverage,
        branches: coverage * 0.85,
        functions: coverage,
        statements: coverage,
        files: {},
      };
    } catch (err) {
      return {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
        files: {},
      };
    }
  }
}
