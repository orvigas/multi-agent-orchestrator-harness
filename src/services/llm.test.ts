import { test } from "node:test";
import assert from "node:assert/strict";
import { HARNESS_MODE } from "./llm.js";

test("HARNESS_MODE defaults to 'deterministic'", () => {
  assert.equal(HARNESS_MODE, "deterministic");
});
