import fs from "fs";
import path from "path";

export interface DetectionResult {
  languages: string[];
  buildSystems: string[];
  packageManagers: string[];
}

export function detectLanguages(rootPath: string): DetectionResult {
  const detectedLanguages: Set<string> = new Set();
  const buildSystems: Set<string> = new Set();
  const packageManagers: Set<string> = new Set();

  try {
    // Check for language-specific file extensions
    const files = fs.readdirSync(rootPath, { recursive: true }) as string[];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();

      if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
        detectedLanguages.add("typescript");
      } else if ([".java"].includes(ext)) {
        detectedLanguages.add("java");
      } else if ([".py"].includes(ext)) {
        detectedLanguages.add("python");
      } else if ([".go"].includes(ext)) {
        detectedLanguages.add("go");
      } else if ([".rs"].includes(ext)) {
        detectedLanguages.add("rust");
      }
    }

    // Check for build system files
    if (fs.existsSync(path.join(rootPath, "package.json"))) {
      detectedLanguages.add("typescript");
      buildSystems.add("npm");
      packageManagers.add("npm");
    }
    if (fs.existsSync(path.join(rootPath, "pom.xml"))) {
      detectedLanguages.add("java");
      buildSystems.add("maven");
      packageManagers.add("maven");
    }
    if (fs.existsSync(path.join(rootPath, "build.gradle"))) {
      detectedLanguages.add("java");
      buildSystems.add("gradle");
      packageManagers.add("gradle");
    }
    if (fs.existsSync(path.join(rootPath, "requirements.txt"))) {
      detectedLanguages.add("python");
      buildSystems.add("pip");
      packageManagers.add("pip");
    }
    if (fs.existsSync(path.join(rootPath, "pyproject.toml"))) {
      detectedLanguages.add("python");
      buildSystems.add("poetry");
      packageManagers.add("poetry");
    }
    if (fs.existsSync(path.join(rootPath, "go.mod"))) {
      detectedLanguages.add("go");
      buildSystems.add("go-modules");
      packageManagers.add("go");
    }
    if (fs.existsSync(path.join(rootPath, "Cargo.toml"))) {
      detectedLanguages.add("rust");
      buildSystems.add("cargo");
      packageManagers.add("cargo");
    }
  } catch (err) {
    console.error("Error detecting languages:", err);
  }

  return {
    languages: Array.from(detectedLanguages),
    buildSystems: Array.from(buildSystems),
    packageManagers: Array.from(packageManagers),
  };
}

export function getLanguageFileExtensions(language: string): string[] {
  const extMap: Record<string, string[]> = {
    typescript: [".ts", ".tsx", ".js", ".jsx"],
    java: [".java"],
    python: [".py"],
    go: [".go"],
    rust: [".rs"],
  };

  return extMap[language] || [];
}

export function getLanguageFromFileExtension(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();

  const extMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "typescript",
    ".jsx": "typescript",
    ".java": "java",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
  };

  return extMap[ext] || null;
}
