import { describe, expect, it } from "vitest";
import { escapeHtml, parseMarkdownBlocks } from "@/features/assistant/chat-markdown";

describe("chat markdown sanitization", () => {
  it("escapes raw HTML and only parses safe markdown structures", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    const blocks = parseMarkdownBlocks(
      [
        "# Title",
        "",
        "Use `note()` and **gain**.",
        "",
        "- one",
        "- two",
        "",
        "```js",
        's("bd")',
        "```",
        "",
        "See [Strudel](https://strudel.cc) and [bad](javascript:alert(1)).",
      ].join("\n"),
    );
    expect(blocks[0]).toEqual({ kind: "heading", level: 1, text: "Title" });
    expect(blocks.some((block) => block.kind === "code" && block.code.includes('s("bd")'))).toBe(
      true,
    );
    expect(blocks.some((block) => block.kind === "list" && block.items.length === 2)).toBe(true);
    expect(JSON.stringify(blocks)).not.toContain("<script>");
  });
});
