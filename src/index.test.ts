import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveTargetPath, resolveBacklog } from "./index.js";
import type { Ticket } from "./orchestrator/types.js";

describe("resolveTargetPath", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns cwd when no target provided", () => {
    const result = resolveTargetPath();
    assert.strictEqual(result, process.cwd());
  });

  it("returns absolute path when valid target provided", () => {
    const result = resolveTargetPath(tempDir);
    assert.strictEqual(result, tempDir);
  });

  it("resolves relative paths to absolute", () => {
    // Create a subdirectory in tempDir
    const subDir = path.join(tempDir, "subdir");
    fs.mkdirSync(subDir);

    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      const result = resolveTargetPath("./subdir");
      // Resolve both to real paths for comparison (handles symlinks on macOS)
      const expected = fs.realpathSync(subDir);
      assert.strictEqual(result, expected);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("throws error when target does not exist", () => {
    const nonexistent = path.join(tempDir, "does-not-exist");
    assert.throws(
      () => resolveTargetPath(nonexistent),
      (err: Error) => {
        return err.message.includes("Target repo not found");
      }
    );
  });

  it("throws error when target is a file, not a directory", () => {
    const filePath = path.join(tempDir, "file.txt");
    fs.writeFileSync(filePath, "test");

    assert.throws(
      () => resolveTargetPath(filePath),
      (err: Error) => {
        return err.message.includes("Target is not a directory");
      }
    );
  });
});

describe("resolveBacklog", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns demo backlog when no arguments provided", () => {
    const result = resolveBacklog();
    assert(Array.isArray(result));
    assert(result.length > 0);
    assert.strictEqual(result[0].id, "T-1");
  });

  it("creates single ticket from ticketId", () => {
    const result = resolveBacklog("CUSTOM-1", "Custom title", "Custom description");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "CUSTOM-1");
    assert.strictEqual(result[0].title, "Custom title");
    assert.strictEqual(result[0].description, "Custom description");
    assert.strictEqual(result[0].status, "pending");
  });

  it("uses ticketId as title fallback when title not provided", () => {
    const result = resolveBacklog("FALLBACK-ID");
    assert.strictEqual(result[0].title, "FALLBACK-ID");
  });

  it("loads backlog from JSON file", () => {
    const backlogPath = path.join(tempDir, "backlog.json");
    const tickets: Ticket[] = [
      { id: "FILE-1", title: "From file", description: "Test", status: "pending" },
      { id: "FILE-2", title: "Another", description: "Test 2", status: "pending" },
    ];
    fs.writeFileSync(backlogPath, JSON.stringify(tickets));

    const result = resolveBacklog(undefined, undefined, undefined, backlogPath);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, "FILE-1");
    assert.strictEqual(result[1].id, "FILE-2");
  });

  it("prefers backlog file over other arguments", () => {
    const backlogPath = path.join(tempDir, "backlog.json");
    const tickets: Ticket[] = [
      { id: "FILE-1", title: "From file", description: "Test", status: "pending" },
    ];
    fs.writeFileSync(backlogPath, JSON.stringify(tickets));

    const result = resolveBacklog("IGNORED-ID", "Ignored title", "Ignored desc", backlogPath);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "FILE-1");
  });

  it("prefers ticketId over demo backlog", () => {
    const result = resolveBacklog("CUSTOM-1");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "CUSTOM-1");
  });
});
