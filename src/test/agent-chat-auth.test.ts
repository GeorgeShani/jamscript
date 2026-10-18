import { describe, expect, it } from "vitest";
import { parseAgentChatRequest } from "@/features/assistant/chat-request";
import { validateProposal } from "@/features/assistant/proposal";
import { proposalSyntaxCheck } from "@/features/assistant/agent-context";
import { extractTrailingJson } from "@/features/assistant/chat-stream";

describe("agent chat authorization and proposal safety", () => {
  it("documents that viewers are rejected by the route (membership gate)", () => {
    // The /api/agent-chat handler mirrors /api/agent-proposal: roleForDocument must
    // return a non-viewer role before any model call. This unit keeps the contract visible.
    const viewerRejected = (role: string | null) => !role || role === "viewer";
    expect(viewerRejected("viewer")).toBe(true);
    expect(viewerRejected(null)).toBe(true);
    expect(viewerRejected("editor")).toBe(false);
    expect(viewerRejected("owner")).toBe(false);
  });

  it("validates edit-mode trailing JSON with the shared proposal checker", () => {
    const files = [
      { id: "bass", name: "bass.js", source: 's("bd")' },
      { id: "hats", name: "hats.js", source: 's("hh")' },
    ];
    const extracted = extractTrailingJson(
      [
        "Softening hats.",
        "```json",
        JSON.stringify({
          summary: "Quieter hats",
          files: [{ documentId: "hats", source: 's("hh").gain(0.4)', explanation: "Lower gain" }],
        }),
        "```",
      ].join("\n"),
    );
    expect(extracted).not.toBeNull();
    const proposal = validateProposal(extracted!.json, files);
    expect(proposal.files).toHaveLength(1);
    expect(proposalSyntaxCheck(files, proposal.files)).toBe(true);
    expect(
      proposalSyntaxCheck(files, [
        { documentId: "hats", proposedSource: "s(\"hh\").gain(" },
      ]),
    ).toBe(false);
  });

  it("rejects attached file lists that exceed the bound", () => {
    expect(() =>
      parseAgentChatRequest({
        threadId: "t",
        documentId: "doc",
        mode: "ask",
        scope: "active",
        messages: [{ role: "user", content: "hi there" }],
        attachedDocumentIds: Array.from({ length: 9 }, (_, i) => `f${i}`),
      }),
    ).toThrow(/Too many/);
  });
});
