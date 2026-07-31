export interface ValidationError {
  file: string;
  line: number;
  column?: number;
  message: string;
  code?: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  duration: number;
}

export interface SecurityIssue {
  file: string;
  line?: number;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
  cveId?: string;
}

export interface LanguageValidator {
  language: string;

  /**
   * Validate code compiles/is syntactically correct.
   */
  validateSyntax(filePath: string): ValidationResult;

  /**
   * Run static analysis/linting.
   */
  validateStatic(rootPath: string): ValidationResult;

  /**
   * Run security checks.
   */
  validateSecurity(rootPath: string): SecurityIssue[];
}
