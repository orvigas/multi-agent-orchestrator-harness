import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

function getCheckpointPath(): string {
  if (process.env.CHECKPOINT_DB_PATH) {
    return process.env.CHECKPOINT_DB_PATH;
  }
  return path.join("data", "harness-checkpoints.db");
}

export async function validateCheckpointer(): Promise<{ success: boolean; path: string; message?: string }> {
  try {
    const dbPath = getCheckpointPath();
    const dir = path.dirname(dbPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);
    db.exec("CREATE TABLE IF NOT EXISTS checkpoints (id TEXT PRIMARY KEY, data TEXT)");
    db.close();

    return { success: true, path: dbPath };
  } catch (error) {
    return { success: false, path: getCheckpointPath(), message: `Checkpointer validation failed: ${error}` };
  }
}

export function createCheckpointer() {
  const dbPath = getCheckpointPath();
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  db.exec("CREATE TABLE IF NOT EXISTS checkpoints (id TEXT PRIMARY KEY, data TEXT)");

  return {
    get: (key: string) => {
      const stmt = db.prepare("SELECT data FROM checkpoints WHERE id = ?");
      const row = stmt.get(key) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    put: (key: string, value: any) => {
      const stmt = db.prepare("INSERT OR REPLACE INTO checkpoints (id, data) VALUES (?, ?)");
      stmt.run(key, JSON.stringify(value));
    },
    delete: (key: string) => {
      const stmt = db.prepare("DELETE FROM checkpoints WHERE id = ?");
      stmt.run(key);
    },
    close: () => db.close(),
  };
}
