import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { isTimeoutError, isRateLimitError, LLMTimeoutError } from "./providerFallback.js";
import { callProvider } from "./llm.js";

/**
 * Phase 2.5: timeout enforcement tests.
 * The end-to-end test hits a real HTTP server that accepts the connection and
 * never answers, so the AbortController path is exercised for real (same spirit
 * as validation-pipeline/exec.test.ts's real-timeout test).
 */

test("isTimeoutError: recognizes our own LLMTimeoutError", () => {
  const error = new LLMTimeoutError("anthropic", "claude-opus-5", 30_000);
  assert.ok(isTimeoutError(error));
  assert.equal(error.provider, "anthropic");
  assert.equal(error.model, "claude-opus-5");
  assert.equal(error.timeoutMs, 30_000);
  assert.match(error.message, /Timeout after 30000ms calling anthropic\/claude-opus-5/);
});

test("isTimeoutError: recognizes SDK abort errors by name", () => {
  const abortError = new Error("Request was aborted.");
  abortError.name = "APIUserAbortError";
  assert.ok(isTimeoutError(abortError));

  const domAbort = new Error("This operation was aborted");
  domAbort.name = "AbortError";
  assert.ok(isTimeoutError(domAbort));
});

test("isTimeoutError: recognizes socket timeout error codes", () => {
  const etimedout = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
  assert.ok(isTimeoutError(etimedout));

  const esocket = Object.assign(new Error("socket hang up"), { code: "ESOCKETTIMEDOUT" });
  assert.ok(isTimeoutError(esocket));
});

test("isTimeoutError: returns false for unrelated errors", () => {
  assert.ok(!isTimeoutError(new Error("401 authentication_error: invalid x-api-key")));
  assert.ok(!isTimeoutError(new Error("No text content in LLM response")));
  assert.ok(!isTimeoutError(null));
  assert.ok(!isTimeoutError(undefined));
});

test("isTimeoutError/isRateLimitError: a rate limit is not classified as a timeout", () => {
  const rateLimit = Object.assign(new Error("429 rate_limit_exceeded"), { status: 429 });
  assert.ok(isRateLimitError(rateLimit));
  // The retry loop checks isRateLimitError first, so overlap would not change
  // behaviour, but the two classifiers must not both claim this error.
  assert.ok(!isTimeoutError(rateLimit));
});

test("callProvider: rejects an unsupported provider before opening any connection", async () => {
  await assert.rejects(
    () =>
      callProvider(
        "not-a-provider",
        "some-model",
        { role: "implementer", systemPrompt: "s", userPrompt: "u" },
        "fake-key",
        1_000
      ),
    /Unsupported provider: not-a-provider/
  );
});

test("callProvider: aborts a hanging request and reports it as LLMTimeoutError", async () => {
  // A real server that accepts the request and never responds.
  const server = http.createServer(() => {
    /* deliberately silent: the client must give up on its own */
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const previousBaseUrl = process.env["ANTHROPIC_BASE_URL"];
  process.env["ANTHROPIC_BASE_URL"] = `http://127.0.0.1:${port}`;

  try {
    const timeoutMs = 400;
    const startedAt = Date.now();

    await assert.rejects(
      () =>
        callProvider(
          "anthropic",
          "claude-opus-5",
          { role: "implementer", systemPrompt: "s", userPrompt: "u" },
          "fake-key",
          timeoutMs
        ),
      (error: unknown) => {
        assert.ok(error instanceof LLMTimeoutError, `expected LLMTimeoutError, got ${error}`);
        assert.equal(error.provider, "anthropic");
        assert.equal(error.timeoutMs, timeoutMs);
        assert.ok(isTimeoutError(error));
        return true;
      }
    );

    const elapsed = Date.now() - startedAt;
    assert.ok(elapsed >= timeoutMs, `aborted too early (${elapsed}ms < ${timeoutMs}ms)`);
    assert.ok(elapsed < timeoutMs + 5_000, `abort took far too long (${elapsed}ms)`);
  } finally {
    if (previousBaseUrl === undefined) {
      delete process.env["ANTHROPIC_BASE_URL"];
    } else {
      process.env["ANTHROPIC_BASE_URL"] = previousBaseUrl;
    }
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
});

test("callProvider: clears its timeout timer, leaving no pending handle behind", async () => {
  // A fast failure (unsupported provider) must not leave the 60s timer armed —
  // a leaked timer keeps the Node process alive after the work is done.
  const timersBefore = process
    .getActiveResourcesInfo()
    .filter((r) => r === "Timeout").length;

  await assert.rejects(() =>
    callProvider(
      "not-a-provider",
      "some-model",
      { role: "implementer", systemPrompt: "s", userPrompt: "u" },
      "fake-key",
      60_000
    )
  );

  const timersAfter = process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
  assert.ok(
    timersAfter <= timersBefore,
    `callProvider leaked a timer (${timersBefore} -> ${timersAfter})`
  );
});
