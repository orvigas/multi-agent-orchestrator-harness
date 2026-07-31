import { spawnSync } from "child_process";
import path from "path";
import type { LanguageValidator, ValidationResult, SecurityIssue, ValidationError } from "./LanguageValidator.js";

export class JavaValidator implements LanguageValidator {
  language = "java";

  validateSyntax(filePath: string): ValidationResult {
    const startTime = Date.now();

    try {
      // Try to compile with javac
      const result = spawnSync("javac", ["-d", "/tmp", filePath], {
        encoding: "utf-8",
        timeout: 30000,
      });

      const errors: ValidationError[] = [];

      if (result.stderr) {
        // Parse javac error output
        const lines = result.stderr.split("\n");
        for (const line of lines) {
          const errorMatch = line.match(/([^:]+):(\d+):\s*error:\s*(.+)/);
          if (errorMatch) {
            errors.push({
              file: errorMatch[1],
              line: parseInt(errorMatch[2]),
              message: errorMatch[3],
              severity: "error",
              code: "SYNTAX_ERROR",
            });
          }
        }
      }

      const duration = Date.now() - startTime;

      return {
        passed: result.status === 0,
        errors,
        duration,
      };
    } catch (err) {
      // javac not available, return error
      const duration = Date.now() - startTime;
      return {
        passed: false,
        errors: [
          {
            file: filePath,
            line: 0,
            message: `Unable to validate: javac not found or error: ${err}`,
            severity: "error",
          },
        ],
        duration,
      };
    }
  }

  validateStatic(rootPath: string): ValidationResult {
    const startTime = Date.now();
    const errors: ValidationError[] = [];

    try {
      // Try checkstyle if available
      const checkstyleResult = spawnSync("checkstyle", ["-c", "/sun_checks.xml", rootPath], {
        encoding: "utf-8",
        timeout: 60000,
      });

      if (checkstyleResult.stderr) {
        const lines = checkstyleResult.stderr.split("\n");
        for (const line of lines) {
          // Parse checkstyle warnings
          const warningMatch = line.match(/\[WARN\]\s+([^:]+):(\d+):\s*(.+)/);
          if (warningMatch) {
            errors.push({
              file: warningMatch[1],
              line: parseInt(warningMatch[2]),
              message: warningMatch[3],
              severity: "warning",
              code: "STYLE_VIOLATION",
            });
          }
        }
      }
    } catch (err) {
      // checkstyle not available, that's OK
    }

    // Try PMD if available
    try {
      const pmdResult = spawnSync("pmd", ["-d", rootPath, "-f", "json"], {
        encoding: "utf-8",
        timeout: 60000,
      });

      if (pmdResult.stdout) {
        try {
          const report = JSON.parse(pmdResult.stdout);
          if (report.files) {
            for (const file of report.files) {
              if (file.violations) {
                for (const violation of file.violations) {
                  errors.push({
                    file: file.name,
                    line: violation.line,
                    column: violation.column,
                    message: violation.message,
                    severity: violation.priority <= 2 ? "error" : "warning",
                    code: violation.rule,
                  });
                }
              }
            }
          }
        } catch (parseErr) {
          // Skip PMD if JSON parsing fails
        }
      }
    } catch (err) {
      // PMD not available, that's OK
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
    const startTime = Date.now();

    try {
      // Try OWASP Dependency-Check if available
      const depCheckResult = spawnSync("dependency-check", ["--scan", rootPath, "--format", "JSON", "--out", "/tmp"], {
        encoding: "utf-8",
        timeout: 120000,
      });

      if (depCheckResult.stdout) {
        try {
          const report = JSON.parse(depCheckResult.stdout);
          if (report.reportSchema && report.reportSchema.dependencies) {
            for (const dep of report.reportSchema.dependencies) {
              if (dep.vulnerabilities) {
                for (const vuln of dep.vulnerabilities) {
                  issues.push({
                    file: `${rootPath}/pom.xml`, // Simplified: point to pom.xml
                    message: `Vulnerable dependency: ${dep.name} - ${vuln.name}`,
                    severity: this.parseSeverity(vuln.severity),
                    cveId: vuln.cve,
                  });
                }
              }
            }
          }
        } catch (parseErr) {
          // Skip if JSON parsing fails
        }
      }
    } catch (err) {
      // Dependency-Check not available, that's OK
    }

    // Try Snyk if available
    try {
      const snykResult = spawnSync("snyk", ["test", "--json"], {
        cwd: rootPath,
        encoding: "utf-8",
        timeout: 120000,
      });

      if (snykResult.stdout) {
        try {
          const report = JSON.parse(snykResult.stdout);
          if (report.vulnerabilities) {
            for (const vuln of report.vulnerabilities) {
              issues.push({
                file: vuln.from ? vuln.from[0] : `${rootPath}/pom.xml`,
                message: `Security vulnerability: ${vuln.title}`,
                severity: this.parseSeverity(vuln.severity),
                cveId: vuln.cve,
              });
            }
          }
        } catch (parseErr) {
          // Skip if JSON parsing fails
        }
      }
    } catch (err) {
      // Snyk not available, that's OK
    }

    return issues;
  }

  private parseSeverity(severity: string | undefined): "critical" | "high" | "medium" | "low" {
    if (!severity) return "medium";

    const lower = severity.toLowerCase();
    if (lower.includes("critical")) return "critical";
    if (lower.includes("high")) return "high";
    if (lower.includes("medium")) return "medium";
    return "low";
  }
}
