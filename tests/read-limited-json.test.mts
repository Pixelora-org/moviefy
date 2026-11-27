import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readLimitedJson } from "../lib/http/read-limited-json.ts";

describe("readLimitedJson", () => {
  it("parses a JSON request within the byte limit", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: '{"x":1}',
    });

    assert.deepEqual(await readLimitedJson(request, 7), {
      ok: true,
      value: { x: 1 },
    });
  });

  it("rejects a request exceeding the byte limit while streaming", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: '{"x":"too long"}',
    });

    assert.deepEqual(await readLimitedJson(request, 7), {
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: "{",
    });

    assert.deepEqual(await readLimitedJson(request, 7), {
      ok: false,
      reason: "invalid_json",
    });
  });
});
