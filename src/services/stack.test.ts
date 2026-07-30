import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { detectStack } from "./stack.js";

describe("detectStack", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stack-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects TypeScript + npm when tsconfig.json exists", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "test" }));
    fs.writeFileSync(path.join(tempDir, "tsconfig.json"), "{}");

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.language, "typescript");
    assert.strictEqual(stack.pm, "npm");
  });

  it("detects JavaScript when no tsconfig.json", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "test" }));

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.language, "javascript");
    assert.strictEqual(stack.pm, "npm");
  });

  it("detects pnpm from packageManager field", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "test", packageManager: "pnpm@8.0.0" })
    );

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.pm, "pnpm");
  });

  it("detects yarn from packageManager field", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "test", packageManager: "yarn@3.6.0" })
    );

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.pm, "yarn");
  });

  it("detects React framework from dependencies", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: { react: "^18.0.0" },
      })
    );

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.framework, "react");
  });

  it("detects Python + pip", () => {
    fs.writeFileSync(path.join(tempDir, "requirements.txt"), "django==4.0.0\n");

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.language, "python");
    assert.strictEqual(stack.pm, "pip");
  });

  it("detects Django framework", () => {
    fs.writeFileSync(path.join(tempDir, "requirements.txt"), "django==4.0.0\ndjango-rest-framework\n");

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.language, "python");
    assert.strictEqual(stack.framework, "django");
  });

  it("detects Go", () => {
    fs.writeFileSync(path.join(tempDir, "go.mod"), "module example.com/myapp\n");

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.language, "go");
    assert.strictEqual(stack.pm, "go");
  });

  it("defaults to TypeScript when no markers found", () => {
    const stack = detectStack(tempDir);
    assert.strictEqual(stack.language, "typescript");
    assert.strictEqual(stack.pm, "npm");
  });

  it("prefers Node detection over generic JavaScript", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: { express: "^4.18.0" },
      })
    );

    const stack = detectStack(tempDir);
    assert.strictEqual(stack.language, "javascript");
    assert.strictEqual(stack.framework, "node");
  });
});
