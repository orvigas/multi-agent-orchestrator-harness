import { spawnSync } from "child_process";
import type { LanguageValidator, ValidationResult, SecurityIssue } from "./LanguageValidator.js";

export class GoValidator implements LanguageValidator {
  language = "go";

  validateSyntax(filePath: string): ValidationResult {
    const startTime = Date.now();

    try {
      const result = spawnSync("go", ["build", filePath], {
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
              code: "BUILD_ERROR",
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
      // go vet for static analysis
      const vetResult = spawnSync("go", ["vet", "./..."], {
        cwd: rootPath,
        encoding: "utf-8",
        timeout: 60000,
      });

      if (vetResult.stderr) {
        const lines = vetResult.stderr.split("\n");
        for (const line of lines) {
          const match = line.match(/([^:]+):(\d+):\s*(.+)/);
          if (match) {
            errors.push({
              file: match[1],
              line: parseInt(match[2]),
              message: match[3],
              severity: "warning",
              code: "VET_WARNING",
            });
          }
        }
      }
    } catch (err) {
      // go vet not available or failed
    }

    try {
      // golangci-lint for additional checks
      const lintResult = spawnSync("golangci-lint", ["run", "."], {
        cwd: rootPath,
        encoding: "utf-8",
        timeout: 60000,
      });

      if (lintResult.stderr) {
        const lines = lintResult.stderr.split("\n");
        for (const line of lines) {
          const match = line.match(/([^:]+):(\d+):\d+:\s*(.+)/);
          if (match) {
            errors.push({
              file: match[1],
              line: parseInt(match[2]),
              message: match[3],
              severity: "warning",
            });
          }
        }
      }
    } catch (err) {
      // golangci-lint not available
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
      // gosec for security analysis
      const gosecResult = spawnSync("gosec", ["-fmt=json", "./..."], {
        cwd: rootPath,
        encoding: "utf-8",
        timeout: 60000,
      });

      if (gosecResult.stdout) {
        try {
          const report = JSON.parse(gosecResult.stdout);
          if (report.Issues) {
            for (const issue of report.Issues) {
              issues.push({
                file: issue.file,
                line: issue.line,
                message: issue.details,
                severity: this.parseSeverity(issue.severity),
              });
            }
          }
        } catch (parseErr) {
          // Skip if JSON parsing fails
        }
      }
    } catch (err) {
      // gosec not available
    }

    return issues;
  }

  private parseSeverity(severity: string): "critical" | "high" | "medium" | "low" {
    if (!severity) return "medium";
    const upper = severity.toUpperCase();
    if (upper === "HIGH") return "high";
    if (upper === "MEDIUM") return "medium";
    if (upper === "LOW") return "low";
    return "medium";
  }
}
