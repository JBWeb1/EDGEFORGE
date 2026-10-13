import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  it("parses bold, code and citations", () => {
    assert.deepEqual(parseInline("**Breakouts** win [T3, T7] and `PF` [T1]."), [
      { type: "bold", text: "Breakouts" },
      { type: "text", text: " win " },
      { type: "cite", ref: "T3" },
      { type: "cite", ref: "T7" },
      { type: "text", text: " and " },
      { type: "code", text: "PF" },
      { type: "text", text: " " },
      { type: "cite", ref: "T1" },
      { type: "text", text: "." },
    ]);
  });
  it("leaves other brackets and HTML as plain text", () => {
    assert.deepEqual(parseInline("[link] <script>x</script>"), [{ type: "text", text: "[link] <script>x</script>" }]);
  });
});

describe("parseMarkdown", () => {
  it("splits headings, paragraphs and lists", () => {
    const blocks = parseMarkdown("## Summary\nYou did well.\nReally.\n\n- one\n- two\n  continued\n1. first\n2. second");
    assert.deepEqual(blocks.map((b) => b.type), ["heading", "paragraph", "list", "list"]);
    assert.deepEqual(blocks[1], { type: "paragraph", content: [{ type: "text", text: "You did well. Really." }] });
    const bullets = blocks[2];
    assert.ok(bullets.type === "list" && !bullets.ordered && bullets.items.length === 2);
    assert.deepEqual(bullets.items[1], [{ type: "text", text: "two continued" }]);
    assert.ok(blocks[3].type === "list" && blocks[3].ordered);
  });
});
