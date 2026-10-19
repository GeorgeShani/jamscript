import { describe, expect, it } from "vitest";
import { parseStructuredEdit } from "@/features/assistant/structured-edit";

const files = [
  { id: "drums", name: "drums.js", source: 's("bd ~ sd ~")' },
  { id: "bass", name: "bass.js", source: 'note("c2").s("sawtooth")' },
];

describe("structured assistant edits", () => {
  it("turns valid model JSON into a source-versioned review proposal", () => {
    const proposal = parseStructuredEdit(
      JSON.stringify({
        summary: "Add a second kick",
        files: [
          {
            documentId: "drums",
            source: 's("bd bd sd ~")',
            explanation: "Added a kick on the second step.",
          },
        ],
      }),
      files,
    );
    expect(proposal.files[0]).toMatchObject({
      baseSource: 's("bd ~ sd ~")',
      proposedSource: 's("bd bd sd ~")',
    });
  });

  it("rejects malformed JSON, unknown files, and syntax errors", () => {
    expect(() => parseStructuredEdit("Sure, I changed it!", files)).toThrow(/invalid proposal/);
    expect(() =>
      parseStructuredEdit(
        JSON.stringify({
          summary: "Oops",
          files: [{ documentId: "other", source: 's("bd")', explanation: "changed" }],
        }),
        files,
      ),
    ).toThrow(/unauthorized file/);
    expect(() =>
      parseStructuredEdit(
        JSON.stringify({
          summary: "Oops",
          files: [{ documentId: "drums", source: 's("bd"', explanation: "changed" }],
        }),
        files,
      ),
    ).toThrow(/syntax error/);
  });
});
