import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import type { LanguageTestRunner, TestResult, CoverageReport, TestOptions } from "./LanguageTestRunner.js";

export class RustTestRunner implements LanguageTestRunner {
  language = "rust";

  findTestFiles(rootPath: string): string[] {
    const testFiles: string[] = [];

    const findTests = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (![".git", "target"].some((skip) => fullPath.includes(skip))) {
              findTests(fullPath);
            }
          } else if (entry.name.endsWith(".rs")) {
            // Rust tests are marked with #[test] or #[cfg(test)]
            const content = fs.readFileSync(fullPath, "utf-8");
            if (content.includes("#[test]") || content.includes("#[cfg(test)]")) {
              testFiles.push(fullPath);
            }
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
      // Run cargo test -v for verbose output
      const result = spawnSync("cargo", ["test", "--", "--nocapture"], {
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
        } else if (line.includes("FAILED")) {
          failed++;
        }
      }

      // Try to extract test summary: "test result: ok. 42 passed"
      const summaryMatch = output.match(/test result:\s+ok\.\s+(\d+)\s+passed/);
      if (summaryMatch) {
        passed = parseInt(summaryMatch[1]);
      }

      const failMatch = output.match(/(\d+)\s+failed/);
      if (failMatch) {
        failed = parseInt(failMatch[1]);
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
            testName: "cargo test",
            message: `Failed to run tests: ${err}`,
            stackTrace: "",
          },
        ],
      };
    }
  }

  getCoverage(rootPath: string): CoverageReport {
    // Rust code coverage is less straightforward than other languages
    // Would need tarpaulin or llvm-cov tools
    return {
      lines: 0,
      branches: 0,
      functions: 0,
      statements: 0,
      files: {},
    };
  }
}
