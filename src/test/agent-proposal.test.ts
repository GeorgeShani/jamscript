import { describe, expect, it } from "vitest";
import { proposalIsFresh, validateProposal } from "@/features/assistant/proposal";

const files = [
  { id: "bass", name: "bass.js", source: 's("bd")' },
  { id: "drums", name: "drums.js", source: 's("sd")' },
];

describe("reviewed agent proposals", () => {
  it("accepts authorized multi-file changes and detects stale sources", () => {
    const proposal = validateProposal(
      {
        summary: "Adjust rhythm",
        files: [
          { documentId: "bass", source: 's("bd ~")', explanation: "Add rest" },
          { documentId: "drums", source: 's("sd sd")', explanation: "Repeat snare" },
        ],
      },
      files,
    );
    expect(proposal.files).toHaveLength(2);
    expect(proposalIsFresh(proposal, files)).toBe(true);
    expect(proposalIsFresh(proposal, [{ ...files[0]!, source: "changed" }, files[1]!])).toBe(false);
  });

  it("rejects unknown files, duplicates, and empty changes", () => {
    expect(() =>
      validateProposal(
        { summary: "x", files: [{ documentId: "secret", source: "x", explanation: "x" }] },
        files,
      ),
    ).toThrow();
    expect(() =>
      validateProposal(
        {
          summary: "x",
          files: [
            { documentId: "bass", source: "x", explanation: "x" },
            { documentId: "bass", source: "y", explanation: "y" },
          ],
        },
        files,
      ),
    ).toThrow();
    expect(() =>
      validateProposal(
        {
          summary: "x",
          files: [{ documentId: "bass", source: files[0]!.source, explanation: "x" }],
        },
        files,
      ),
    ).toThrow();
  });
});
