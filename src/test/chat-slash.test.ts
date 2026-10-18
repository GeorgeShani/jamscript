import { describe, expect, it } from "vitest";
import { expandSlashPrompt, parseSlashCommand } from "@/features/assistant/chat-slash";
import { proposalIsFresh } from "@/features/assistant/proposal";
import { lineDiffCounts } from "@/features/assistant/chat-diff";

describe("slash commands and proposal freshness", () => {
  it("expands explain and fix shortcuts from selection or problems", () => {
    expect(parseSlashCommand("/clear")).toEqual({ command: "clear", rest: "" });
    expect(expandSlashPrompt("explain", "", { selection: 's("bd")', problems: "" })).toContain(
      's("bd")',
    );
    expect(
      expandSlashPrompt("fix", "", {
        selection: "",
        problems: "Line 2: Unexpected token",
      }),
    ).toContain("Unexpected token");
  });

  it("marks stale proposals after the base source changes", () => {
    const proposal = {
      summary: "x",
      files: [
        {
          documentId: "a",
          name: "a.js",
          baseSource: 's("bd")',
          proposedSource: 's("bd ~")',
          explanation: "rest",
        },
      ],
    };
    expect(proposalIsFresh(proposal, [{ id: "a", source: 's("bd")' }])).toBe(true);
    expect(proposalIsFresh(proposal, [{ id: "a", source: 's("sd")' }])).toBe(false);
    expect(lineDiffCounts("a\nb", "a\nc")).toEqual({ added: 1, removed: 1 });
  });
});
