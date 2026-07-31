import fs from "node:fs";
import path from "node:path";

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function withEnv<T>(
  envMap: Record<string, string | undefined>,
  fn: () => T
): T {
  const original: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(envMap)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export const DEFAULT_CHECKPOINT_DB_PATH = "./data/harness-checkpoints.db";

export function resolveCheckpointDbPath(): string {
  return process.env.CHECKPOINT_DB_PATH ?? DEFAULT_CHECKPOINT_DB_PATH;
}
