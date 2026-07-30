import fs from "node:fs";
import path from "node:path";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";

/**
 * Create a checkpoint saver for the Orchestrator.
 *
 * TODO (Phase 1.1): Implement SQLite checkpointing
 * - Environment: CHECKPOINT_DB_PATH (./data/harness-checkpoints.db)
 * - Import: import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite"
 * - Return: new SqliteSaver({ connectionString: dbPath })
 *
 * TODO (Phase 1.3): Implement PostgreSQL checkpointing (for production scaling)
 * - Environment: CHECKPOINT_DB_URL
 * - Import: import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"
 * - Return: new PostgresSaver({ connectionString: dbUrl })
 *
 * For now, using MemorySaver (in-memory, no persistence between processes)
 */
export function createCheckpointer(): BaseCheckpointSaver {
  const dbUrl = process.env.CHECKPOINT_DB_URL;
  const dbPath = process.env.CHECKPOINT_DB_PATH;

  if (dbUrl) {
    console.log("⚠️  PostgreSQL checkpointing not yet implemented (TODO Phase 1.3)");
    console.log("Using MemorySaver as fallback (state lost on restart)");
  } else if (dbPath) {
    console.log("⚠️  SQLite checkpointing not yet implemented (TODO Phase 1.1)");
    console.log(`Using MemorySaver as fallback (TODO: implement SqliteSaver with ${dbPath})`);
  } else {
    console.log("📦 Using MemorySaver (in-memory, for development/testing)");
  }

  // Temporary: use MemorySaver until SQLite/PostgreSQL is ready
  return new MemorySaver();
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
