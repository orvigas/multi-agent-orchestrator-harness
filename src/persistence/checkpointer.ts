import fs from "node:fs";
import path from "node:path";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import type { BaseCheckpointSaver } from "@langchain/langgraph";

/**
 * Create a checkpoint saver for the Orchestrator.
 *
 * Phase 1.1: SQLite checkpointing (implemented)
 * - Environment: CHECKPOINT_DB_PATH (./data/harness-checkpoints.db)
 * - Uses: SqliteSaver from @langchain/langgraph-checkpoint-sqlite
 *
 * Phase 1.3: PostgreSQL checkpointing (for future production scaling)
 * - Environment: CHECKPOINT_DB_URL
 * - TODO: Import PostgresSaver from @langchain/langgraph-checkpoint-postgres
 */
export function createCheckpointer(): BaseCheckpointSaver {
  const dbUrl = process.env.CHECKPOINT_DB_URL;
  const dbPath = process.env.CHECKPOINT_DB_PATH || "./data/harness-checkpoints.db";

  if (dbUrl) {
    console.log("⚠️  PostgreSQL checkpointing not yet implemented (TODO Phase 1.3)");
    console.log(`Falling back to SQLite: ${dbPath}`);
  }

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`✅ Using SQLite Checkpointer: ${dbPath}`);
  return new SqliteSaver({ connectionString: `file:${dbPath}` });
}

/**
 * Validate that the checkpoint database directory is accessible.
 * The SQLite file will be created automatically on first use.
 */
export async function validateCheckpointer(): Promise<{ success: boolean; path?: string; error?: string }> {
  const dbPath = process.env.CHECKPOINT_DB_PATH || "./data/harness-checkpoints.db";

  try {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return { success: true, path: dbPath };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
