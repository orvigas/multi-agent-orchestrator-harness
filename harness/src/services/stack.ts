import fs from "node:fs";
import path from "node:path";

export interface Stack {
  language: "typescript" | "javascript" | "python" | "go" | "unknown";
  framework?: "react" | "node" | "django" | "fastapi" | null;
  pm?: "npm" | "pnpm" | "yarn" | "pip" | "go";
}

export function detectStack(targetPath: string): Stack {
  // Detecta lenguaje, framework, y package manager del target repo
  const stack: Stack = { language: "unknown" };

  // 1. Detecta lenguaje y PM mediante package.json (Node/Python)
  const pkgPath = path.join(targetPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

      // Determina lenguaje (TypeScript o JavaScript)
      const hasTsConfig = fs.existsSync(path.join(targetPath, "tsconfig.json"));
      stack.language = hasTsConfig ? "typescript" : "javascript";

      // Detecta framework
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react) stack.framework = "react";
      else if (deps.express || deps.fastify || deps.next) stack.framework = "node";

      // Detecta package manager
      if (pkg.packageManager) {
        if (pkg.packageManager.includes("pnpm")) stack.pm = "pnpm";
        else if (pkg.packageManager.includes("yarn")) stack.pm = "yarn";
        else stack.pm = "npm";
      } else {
        stack.pm = "npm"; // default
      }

      return stack;
    } catch {
      // Si package.json es inválido, continúa con otros detectores
    }
  }

  // 2. Detecta Python
  const pyprojectPath = path.join(targetPath, "pyproject.toml");
  const setupPyPath = path.join(targetPath, "setup.py");
  const requirementsPath = path.join(targetPath, "requirements.txt");

  if (fs.existsSync(pyprojectPath) || fs.existsSync(setupPyPath) || fs.existsSync(requirementsPath)) {
    stack.language = "python";
    stack.pm = "pip";

    // Detecta framework Python
    if (fs.existsSync(requirementsPath)) {
      const reqs = fs.readFileSync(requirementsPath, "utf8");
      if (reqs.includes("django")) stack.framework = "django";
      else if (reqs.includes("fastapi")) stack.framework = "fastapi";
    }

    return stack;
  }

  // 3. Detecta Go
  const goModPath = path.join(targetPath, "go.mod");
  if (fs.existsSync(goModPath)) {
    stack.language = "go";
    stack.pm = "go";
    return stack;
  }

  // Default fallback: TypeScript (el más seguro)
  stack.language = "typescript";
  stack.pm = "npm";

  return stack;
}
