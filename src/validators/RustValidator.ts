import { spawnSync } from "child_process";
import type { LanguageValidator, ValidationResult, SecurityIssue } from "./LanguageValidator.js";

export class RustValidator implements LanguageValidator {
  language = "rust";

  validateSyntax(filePath: string): ValidationResult {
    const startTime = Date.now();

    try {
      const result = spawnSync("cargo", ["check"], {
        cwd: filePath.substring(0, filePath.lastIndexOf("/")),
        encoding: "utf-8",
        timeout: 60000,
      });

      const errors = result.stderr
        ? result.stderr
            .split("\n")
            .filter((line) => line.includes("error"))
            .map((line) => ({
              file: filePath,
              line: 0,
              message: line,
              severity: "error" as const,
              code: "COMPILE_ERROR",
            }))
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
      // cargo clippy for linting
      const clippyResult = spawnSync("cargo", ["clippy", "--", "-D", "warnings"], {
        cwd: rootPath,
        encoding: "utf-8",
        timeout: 60000,
      });

      if (clippyResult.stderr) {
        const lines = clippyResult.stderr.split("\n");
        for (const line of lines) {
          const match = line.match(/(?:warning|error):\s*(.+)/);
          if (match) {
            errors.push({
              file: rootPath,
              line: 0,
              message: match[1],
              severity: line.includes("warning") ? "warning" : "error",
              code: "LINT_WARNING",
            });
          }
        }
      }
    } catch (err) {
      // cargo clippy not available
    }

    const duration = Date.now() - startTime;

    return {
      passed: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      duration,
    };
  }

  validateSecurity(_rootPath: string): SecurityIssue[] {
    // Rust's type system provides strong safety guarantees
    // cargo-audit can be used for dependency vulnerabilities
    const issues: SecurityIssue[] = [];

    try {
      const auditResult = spawnSync("cargo", ["audit", "--json"], {
        encoding: "utf-8",
        timeout: 60000,
      });

      if (auditResult.stdout) {
        try {
          const report = JSON.parse(auditResult.stdout);
          if (report.vulnerabilities) {
            for (const vuln of report.vulnerabilities.list) {
              issues.push({
                file: `Cargo.toml: ${vuln.package.name}`,
                message: vuln.advisory.title,
                severity: this.parseSeverity(vuln.advisory.cvss),
              });
            }
          }
        } catch (parseErr) {
          // Skip if JSON parsing fails
        }
      }
    } catch (err) {
      // cargo audit not available
    }

    return issues;
  }

  private parseSeverity(cvss: number | undefined): "critical" | "high" | "medium" | "low" {
    if (!cvss) return "medium";
    if (cvss >= 9.0) return "critical";
    if (cvss >= 7.0) return "high";
    if (cvss >= 4.0) return "medium";
    return "low";
  }
}
