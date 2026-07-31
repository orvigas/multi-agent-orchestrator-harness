import { test } from "node:test";
import assert from "node:assert";
import { ParserRegistry } from "./ParserRegistry.js";
import { TypeScriptParser } from "./TypeScriptParser.js";

test("ParserRegistry", async (t) => {
  await t.test("should register and retrieve parser", () => {
    const registry = new ParserRegistry();
    const parser = new TypeScriptParser();

    ParserRegistry.register(parser);
    const retrieved = ParserRegistry.getParser("typescript");

    assert.strictEqual(retrieved.language, "typescript");
  });

  await t.test("should throw error for unknown parser", () => {
    assert.throws(() => {
      ParserRegistry.getParser("unknown-language");
    }, /No parser found for language/);
  });

  await t.test("should get parser for file extension", () => {
    const parser = ParserRegistry.getParserForFile("test.ts");
    assert.strictEqual(parser.language, "typescript");
  });

  await t.test("should throw for unknown file extension", () => {
    assert.throws(() => {
      ParserRegistry.getParserForFile("test.xyz");
    }, /Unknown file type/);
  });

  await t.test("should list supported languages", () => {
    const languages = ParserRegistry.supportedLanguages();
    assert.ok(languages.includes("typescript"));
  });

  await t.test("should check if parser exists", () => {
    const hasParser = ParserRegistry.hasParser("typescript");
    assert.strictEqual(hasParser, true);

    const noParser = ParserRegistry.hasParser("fortran");
    assert.strictEqual(noParser, false);
  });
});
