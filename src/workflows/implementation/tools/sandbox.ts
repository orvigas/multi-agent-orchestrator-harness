import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { detectStack, type Stack } from "../../../services/stack.js";
import type { Patch } from "../types.js";

export interface Sandbox {
  path: string;
  type: "filesystem" | "docker";
  containerId?: string; // Only for Docker sandboxes
  taskId: string;
  projectRoot: string;
}

export interface ApplyResult {
  applied: boolean;
  detail: string;
  // Solo poblado en dryRun: cada archivo cuyo contexto ya no calzó — la Capa
  // 8 (Merge Manager) reporta TODOS los conflictos de una vez, a diferencia
  // del apply real, que sigue fallando rápido en el primer hunk malo para
  // nunca dejar un archivo real a medio escribir.
  conflictingFiles?: string[];
}

const SANDBOX_ROOT_NAME = "multiagent-harness-sandboxes";

// Entries a copiar según stack detectado. TypeScript es el default/fallback.
const COPIED_ENTRIES_BY_STACK: Record<Stack["language"], string[]> = {
  typescript: [
    "src",
    "test",
    "tests",
    ".harness",
    "config",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "tsconfig.json",
    "eslint.config.js",
    "eslint.sonar.config.js",
    ".eslintrc.json",
    ".eslintrc.js",
    "vitest.config.ts",
    "jest.config.js",
  ],
  javascript: [
    "src",
    "test",
    "tests",
    ".harness",
    "config",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".eslintrc.json",
    ".eslintrc.js",
    "eslint.config.js",
    "jest.config.js",
  ],
  python: [
    "src",
    "tests",
    ".harness",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "requirements-dev.txt",
    "pytest.ini",
    "tox.ini",
  ],
  go: [
    "cmd",
    "internal",
    ".harness",
    "go.mod",
    "go.sum",
    ".golangci.yml",
    ".golangci.yaml",
    "Makefile",
  ],
  unknown: ["src", ".harness", "config", "package.json"],
};

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isDockerAvailable(): boolean {
  try {
    const result = spawnSync("docker", ["--version"], { timeout: 2000 });
    return result.status === 0;
  } catch {
    return false;
  }
}

function generateContainerId(taskId: string): string {
  return `harness-${sanitize(taskId)}-${Date.now()}`;
}

/**
 * Create a Docker-based sandbox for the task.
 * Resource limits: 512MB memory, 1 CPU, 500MB tmpfs
 * Docker image must be built beforehand or Dockerfile.sandbox must exist.
 */
function createDockerSandbox(taskId: string, projectRoot: string, stack: Stack): Sandbox {
  const dockerfilePath = path.join(projectRoot, "Dockerfile.sandbox");
  if (!fs.existsSync(dockerfilePath)) {
    throw new Error("Dockerfile.sandbox not found at " + dockerfilePath);
  }

  const imageName = "harness-sandbox:latest";
  const buildResult = spawnSync("docker", ["build", "-f", dockerfilePath, "-t", imageName, projectRoot], {
    timeout: 300000, // 5 min timeout
    stdio: "pipe",
  });

  if (buildResult.status !== 0) {
    const stderr = buildResult.stderr?.toString() || "unknown error";
    throw new Error(`Docker image build failed: ${stderr}`);
  }

  const containerId = generateContainerId(taskId);

  // Create container with resource limits
  const createArgs = [
    "create",
    "--name", containerId,
    "--memory", "512m",
    "--cpus", "1.0",
    "--tmpfs", "/tmp:rw,size=500m",
    "-w", "/sandbox",
    imageName,
    "tail", "-f", "/dev/null",
  ];

  const createResult = spawnSync("docker", createArgs, { timeout: 30000, stdio: "pipe" });
  if (createResult.status !== 0) {
    const stderr = createResult.stderr?.toString() || "unknown error";
    throw new Error(`Docker container creation failed: ${stderr}`);
  }

  const startResult = spawnSync("docker", ["start", containerId], { timeout: 30000, stdio: "pipe" });
  if (startResult.status !== 0) {
    const stderr = startResult.stderr?.toString() || "unknown error";
    spawnSync("docker", ["rm", "-f", containerId], { stdio: "pipe" });
    throw new Error(`Docker container start failed: ${stderr}`);
  }

  return {
    path: `/sandbox/repo`,
    type: "docker",
    containerId,
    taskId,
    projectRoot,
  };
}

function createFilesystemSandbox(taskId: string, projectRoot: string, stack: Stack): Sandbox {
  const root = path.join(os.tmpdir(), SANDBOX_ROOT_NAME);
  fs.mkdirSync(root, { recursive: true });
  const sandboxPath = fs.mkdtempSync(path.join(root, `${sanitize(taskId)}-`));

  const entriesToCopy = COPIED_ENTRIES_BY_STACK[stack.language];

  for (const entry of entriesToCopy) {
    const from = path.join(projectRoot, entry);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(sandboxPath, entry), { recursive: true });
  }

  // Symlink node_modules (Node/TypeScript/JavaScript projects)
  if (stack.language === "typescript" || stack.language === "javascript") {
    const nodeModulesFrom = path.join(projectRoot, "node_modules");
    if (fs.existsSync(nodeModulesFrom)) {
      fs.symlinkSync(nodeModulesFrom, path.join(sandboxPath, "node_modules"), "dir");
    }
  }

  return { path: sandboxPath, type: "filesystem", taskId, projectRoot };
}

// "temp-copy": copia el proyecto a un directorio temporal del OS y
// symlinkea node_modules (sin reinstalar) — nunca toca la rama real. El
// how-to usa git worktree; este proyecto no es un repo git (ver ADR de la
// Capa 1 sobre MemorySaver para el mismo tipo de sustitución pragmática).
//
// Por defecto intenta Docker (aislamiento + resource limits), fallback a filesystem.
// Control via env vars:
//   - USE_DOCKER_SANDBOX=true: force Docker (error if not available)
//   - USE_DOCKER_SANDBOX=false: force filesystem (never try Docker)
//   - (default): try Docker, silently fallback to filesystem if not available
export function createSandbox(taskId: string, targetPath?: string): Sandbox {
  const projectRoot = targetPath ?? process.cwd();
  const stack = detectStack(projectRoot);
  const forceDocker = process.env.USE_DOCKER_SANDBOX === "true";
  const forceFilesystem = process.env.USE_DOCKER_SANDBOX === "false";
  const tryDocker = !forceFilesystem && (forceDocker || isDockerAvailable());

  if (tryDocker) {
    try {
      return createDockerSandbox(taskId, projectRoot, stack);
    } catch (err) {
      if (forceDocker) {
        throw err; // Re-throw if Docker was explicitly requested
      }
      // Silently fallback to filesystem
      return createFilesystemSandbox(taskId, projectRoot, stack);
    }
  }

  return createFilesystemSandbox(taskId, projectRoot, stack);
}

export function cleanupSandbox(sandbox: Sandbox | string): void {
  // Handle both old API (string path) and new API (Sandbox object)
  if (typeof sandbox === "string") {
    fs.rmSync(sandbox, { recursive: true, force: true });
    return;
  }

  const { type, containerId, path: sandboxPath } = sandbox;

  if (type === "docker" && containerId) {
    try {
      spawnSync("docker", ["rm", "-f", containerId], { timeout: 30000, stdio: "pipe" });
    } catch (err) {
      // Silently ignore cleanup errors
    }
  } else {
    fs.rmSync(sandboxPath, { recursive: true, force: true });
  }
}

function findSequence(haystack: string[], needle: string[]): number {
  if (needle.length === 0) return -1;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

// Aplica un patch por contexto (nunca por número de línea, sección 1 del
// how-to): busca la secuencia exacta contextBefore+oldLines+contextAfter en
// el archivo sandboxeado y reemplaza oldLines por newLines ahí.
//
// opts.dryRun (Capa 8, Merge Manager): mismo chequeo de contexto, pero NUNCA
// escribe — así se puede detectar si el árbol REAL todavía calza con el
// patch generado contra el snapshot del sandbox, sin necesitar git para
// saberlo. A diferencia del apply real (que falla rápido en el primer hunk
// malo para no dejar un archivo a medio escribir), dryRun sigue revisando
// TODOS los hunks y junta cada archivo conflictivo en conflictingFiles.
export function applyPatch(targetPath: string, patch: Patch, opts?: { dryRun?: boolean }): ApplyResult {
  if (patch.hunks.length === 0) {
    return { applied: true, detail: "patch vacío, nada que aplicar" };
  }

  const conflictingFiles: string[] = [];

  for (const hunk of patch.hunks) {
    const filePath = path.join(targetPath, hunk.file);
    if (!fs.existsSync(filePath)) {
      if (opts?.dryRun) {
        conflictingFiles.push(hunk.file);
        continue;
      }
      return { applied: false, detail: `archivo no encontrado en el sandbox: ${hunk.file}` };
    }

    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    const needle = [...hunk.contextBefore, ...hunk.oldLines, ...hunk.contextAfter];
    const startIndex = findSequence(lines, needle);
    if (startIndex === -1) {
      if (opts?.dryRun) {
        conflictingFiles.push(hunk.file);
        continue;
      }
      return { applied: false, detail: `contexto del hunk no encontrado en ${hunk.file}` };
    }

    if (opts?.dryRun) continue; // contexto calza, nada que mutar en un dry-run

    const oldStart = startIndex + hunk.contextBefore.length;
    lines.splice(oldStart, hunk.oldLines.length, ...hunk.newLines);
    fs.writeFileSync(filePath, lines.join("\n"));
  }

  if (opts?.dryRun) {
    return conflictingFiles.length === 0
      ? { applied: true, detail: "sin conflictos", conflictingFiles: [] }
      : { applied: false, detail: `conflicto de contexto en: ${conflictingFiles.join(", ")}`, conflictingFiles };
  }

  return { applied: true, detail: `${patch.hunks.length} hunk(s) aplicado(s)` };
}
