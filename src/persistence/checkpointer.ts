import path from "node:path";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { ensureDir, resolveCheckpointDbPath } from "../utils/filesystem.js";

/**
 * Create a checkpoint saver for the Orchestrator.
 *
 * Phase 1.1: SQLite checkpointing (implemented)
 * - Environment: CHECKPOINT_DB_PATH (./data/harness-checkpoints.db)
 * - Uses: SqliteSaver from @langchain/langgraph-checkpoint-sqlite
 * - Note: SqliteSaver.fromConnString() handles database initialization
 *
 * Phase 1.3: PostgreSQL checkpointing (for future production scaling)
 * - Environment: CHECKPOINT_DB_URL
 * - TODO: Import PostgresSaver from @langchain/langgraph-checkpoint-postgres
 */
export function createCheckpointer(): BaseCheckpointSaver {
  const dbUrl = process.env.CHECKPOINT_DB_URL;
  const dbPath = resolveCheckpointDbPath();

  if (dbUrl) {
    console.log("⚠️  PostgreSQL checkpointing not yet implemented (TODO Phase 1.3)");
    console.log(`Falling back to SQLite: ${dbPath}`);
  }

  ensureDir(path.dirname(dbPath));
  console.log(`✅ Using SQLite Checkpointer: ${dbPath}`);
  return SqliteSaver.fromConnString(dbPath);
}

/**
 * Validate that the checkpoint database directory is accessible.
 * The SQLite file will be created automatically on first use.
 */
export async function validateCheckpointer(): Promise<{ success: boolean; path?: string; error?: string }> {
  const dbPath = resolveCheckpointDbPath();

  try {
    ensureDir(path.dirname(dbPath));
    return { success: true, path: dbPath };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
