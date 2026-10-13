import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTags } from "./tags";

describe("parseTags", () => {
  it("splits, trims, lowercases and dedupes", () => {
    assert.deepEqual(parseTags(" News, A+  setup;news ,, ").tags, ["news", "a+ setup"]);
  });
  it("rejects long or too many tags", () => {
    assert.ok(parseTags("x".repeat(31)).error);
    assert.ok(parseTags(Array.from({ length: 11 }, (_, i) => `t${i}`).join(",")).error);
    assert.equal(parseTags("").tags.length, 0);
  });
});
