import { spawnSync } from "child_process";
import type { LanguageValidator, ValidationResult, SecurityIssue } from "./LanguageValidator.js";

export class PythonValidator implements LanguageValidator {
  language = "python";

  validateSyntax(filePath: string): ValidationResult {
    const startTime = Date.now();

    try {
      // Use Python's built-in compiler to check syntax
      const result = spawnSync("python", ["-m", "py_compile", filePath], {
        encoding: "utf-8",
        timeout: 30000,
      });

      const errors = result.stderr
        ? [
            {
              file: filePath,
              line: 0,
              message: result.stderr,
              severity: "error" as const,
              code: "SYNTAX_ERROR",
            },
          ]
        : [];

      const duration = Date.now() - startTime;

      return {
        passed: result.status === 0,
        errors,
        duration,
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        passed: false,
        errors: [
          {
            file: filePath,
            line: 0,
            message: `Unable to validate: ${err}`,
            severity: "error",
          },
        ],
        duration,
      };
    }
  }

  validateStatic(rootPath: string): ValidationResult {
    const startTime = Date.now();
    const errors = [];

    try {
      // Try flake8 for linting
      const flake8Result = spawnSync("flake8", [rootPath], {
        encoding: "utf-8",
        timeout: 60000,
      });

      if (flake8Result.stdout) {
        const lines = flake8Result.stdout.split("\n");
        for (const line of lines) {
          const match = line.match(/([^:]+):(\d+):(\d+):\s*([A-Z]\d+)\s+(.+)/);
          if (match) {
            errors.push({
              file: match[1],
              line: parseInt(match[2]),
              column: parseInt(match[3]),
              message: match[5],
              severity: match[4].startsWith("E") ? "error" : "warning",
              code: match[4],
            });
          }
        }
      }
    } catch (err) {
      // flake8 not available, continue
    }

    // Try mypy for type checking
    try {
      const mypyResult = spawnSync("mypy", [rootPath], {
        encoding: "utf-8",
        timeout: 60000,
      });

      if (mypyResult.stdout) {
        const lines = mypyResult.stdout.split("\n");
        for (const line of lines) {
          const match = line.match(/([^:]+):(\d+):\s*error:\s*(.+)/);
          if (match) {
            errors.push({
              file: match[1],
              line: parseInt(match[2]),
              message: match[3],
              severity: "error",
              code: "TYPE_ERROR",
            });
          }
        }
      }
    } catch (err) {
      // mypy not available, continue
    }

    const duration = Date.now() - startTime;

    return {
      passed: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      duration,
    };
  }

  validateSecurity(rootPath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    try {
      // Try bandit for security analysis
      const banditResult = spawnSync("bandit", ["-r", "-f", "json", rootPath], {
        encoding: "utf-8",
        timeout: 60000,
      });

      if (banditResult.stdout) {
        try {
          const report = JSON.parse(banditResult.stdout);
          if (report.results) {
            for (const issue of report.results) {
              issues.push({
                file: issue.filename,
                line: issue.line_number,
                message: issue.issue_text,
                severity: this.parseSeverity(issue.severity),
              });
            }
          }
        } catch (parseErr) {
          // Skip if JSON parsing fails
        }
      }
    } catch (err) {
      // bandit not available, continue
    }

    return issues;
  }

  private parseSeverity(severity: string | undefined): "critical" | "high" | "medium" | "low" {
    if (!severity) return "medium";

    const upper = severity.toUpperCase();
    if (upper === "CRITICAL") return "critical";
    if (upper === "HIGH") return "high";
    if (upper === "MEDIUM") return "medium";
    return "low";
  }
}
