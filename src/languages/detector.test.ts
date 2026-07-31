import { test } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import { detectLanguages, getLanguageFromFileExtension, getLanguageFileExtensions } from "./detector.js";

test("Language Detector", async (t) => {
  await t.test("should detect TypeScript from file extensions", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "detector-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "test.ts"), "export function test() {}");
      const result = detectLanguages(tmpDir);

      assert.ok(result.languages.includes("typescript"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should detect Python from file extensions", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "detector-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "test.py"), "def test(): pass");
      const result = detectLanguages(tmpDir);

      assert.ok(result.languages.includes("python"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should detect Java from file extensions", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "detector-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "Test.java"), "public class Test {}");
      const result = detectLanguages(tmpDir);

      assert.ok(result.languages.includes("java"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should detect build systems from manifest files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "detector-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, "pom.xml"), "<project></project>");

      const result = detectLanguages(tmpDir);

      assert.ok(result.buildSystems.includes("npm"));
      assert.ok(result.buildSystems.includes("maven"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should get language from file extension", () => {
    assert.strictEqual(getLanguageFromFileExtension("test.ts"), "typescript");
    assert.strictEqual(getLanguageFromFileExtension("test.py"), "python");
    assert.strictEqual(getLanguageFromFileExtension("Test.java"), "java");
    assert.strictEqual(getLanguageFromFileExtension("test.go"), "go");
    assert.strictEqual(getLanguageFromFileExtension("test.rs"), "rust");
  });

  await t.test("should return null for unknown extension", () => {
    assert.strictEqual(getLanguageFromFileExtension("test.xyz"), null);
  });

  await t.test("should get file extensions for language", () => {
    const tsExts = getLanguageFileExtensions("typescript");
    assert.ok(tsExts.includes(".ts"));
    assert.ok(tsExts.includes(".tsx"));

    const pyExts = getLanguageFileExtensions("python");
    assert.ok(pyExts.includes(".py"));

    const javaExts = getLanguageFileExtensions("java");
    assert.ok(javaExts.includes(".java"));
  });

  await t.test("should detect multiple languages", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "detector-"));

    try {
      fs.mkdirSync(path.join(tmpDir, "backend"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "frontend"), { recursive: true });

      fs.writeFileSync(path.join(tmpDir, "backend", "Main.java"), "public class Main {}");
      fs.writeFileSync(path.join(tmpDir, "frontend", "App.ts"), "export class App {}");

      const result = detectLanguages(tmpDir);

      assert.ok(result.languages.includes("java"));
      assert.ok(result.languages.includes("typescript"));
      assert.strictEqual(result.languages.length, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
