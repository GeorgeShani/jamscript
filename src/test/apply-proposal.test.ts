import { afterEach, describe, expect, it } from "vitest";
import { undo } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { history } from "@codemirror/commands";
import { applyReviewedProposal } from "@/features/assistant/apply-proposal";
import type { ChangeProposal } from "@/features/assistant/proposal";

const views: EditorView[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
});

function editor(source: string) {
  const view = new EditorView({
    state: EditorState.create({ doc: source, extensions: [history()] }),
    parent: document.body,
  });
  views.push(view);
  return view;
}

const proposal: ChangeProposal = {
  summary: "Coordinate rhythm",
  files: [
    {
      documentId: "drums",
      name: "drums.js",
      baseSource: 's("bd")',
      proposedSource: 's("bd sd")',
      explanation: "Add snare",
    },
    {
      documentId: "bass",
      name: "bass.js",
      baseSource: 'note("c3")',
      proposedSource: 'note("d3")',
      explanation: "Raise bass",
    },
  ],
};

describe("reviewed multi-file apply", () => {
  it("applies and undoes one transaction per fresh, authorized file", () => {
    const drums = editor('s("bd")');
    const bass = editor('note("c3")');
    expect(
      applyReviewedProposal(
        proposal,
        new Map([
          ["drums", drums],
          ["bass", bass],
        ]),
        () => true,
      ),
    ).toBe(true);
    expect(drums.state.doc.toString()).toBe('s("bd sd")');
    expect(bass.state.doc.toString()).toBe('note("d3")');
    expect(undo(drums)).toBe(true);
    expect(undo(bass)).toBe(true);
    expect(drums.state.doc.toString()).toBe('s("bd")');
    expect(bass.state.doc.toString()).toBe('note("c3")');
  });

  it("rejects stale, unavailable, and unauthorized files without partial writes", () => {
    const drums = editor('s("bd")');
    const bass = editor('note("e3")');
    const available = new Map([
      ["drums", drums],
      ["bass", bass],
    ]);
    expect(applyReviewedProposal(proposal, available, () => true)).toBe(false);
    expect(drums.state.doc.toString()).toBe('s("bd")');
    expect(applyReviewedProposal(proposal, available, (id) => id !== "bass")).toBe(false);
    expect(applyReviewedProposal(proposal, new Map([["drums", drums]]), () => true)).toBe(false);
    expect(drums.state.doc.toString()).toBe('s("bd")');
  });
});
