import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "@/features/assistant/ChatPanel";

const views: EditorView[] = [];
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const view of views.splice(0)) view.destroy();
});

function editor(source: string) {
  const view = new EditorView({
    state: EditorState.create({ doc: source }),
    parent: document.body,
  });
  views.push(view);
  return view;
}

describe("assistant edit flow", () => {
  it("applies reviewed file changes independently to live CodeMirror documents", async () => {
    const proposal = {
      summary: "Adjust the groove",
      files: [
        {
          documentId: "drums",
          name: "drums.js",
          baseSource: 's("bd")',
          proposedSource: 's("bd sd")',
          explanation: "Add a snare",
        },
        {
          documentId: "bass",
          name: "bass.js",
          baseSource: 'note("c2")',
          proposedSource: 'note("d2")',
          explanation: "Raise the bass",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init) return Response.json({ available: true });
        return new Response(
          `${JSON.stringify({ type: "text-delta", text: proposal.summary })}\n${JSON.stringify({ type: "proposal", proposal })}\n${JSON.stringify({ type: "done" })}\n`,
          { headers: { "Content-Type": "application/x-ndjson" } },
        );
      }),
    );
    const drums = editor('s("bd")');
    const bass = editor('note("c2")');
    render(
      <ChatPanel
        workspaceId={`edit-test-${crypto.randomUUID()}`}
        documentId="drums"
        documentName="drums.js"
        documents={[
          { id: "drums", name: "drums.js" },
          { id: "bass", name: "bass.js" },
        ]}
        selection=""
        problemsText=""
        sources={[
          { id: "drums", source: 's("bd")' },
          { id: "bass", source: 'note("c2")' },
        ]}
        views={
          new Map([
            ["drums", drums],
            ["bass", bass],
          ])
        }
        canEdit={() => true}
        onReveal={() => undefined}
        onStopPlayback={() => undefined}
      />,
    );
    await screen.findByRole("textbox", { name: "Message the assistant" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Message the assistant" }), {
      target: { value: "Add a snare and raise the bass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Ready to review");
    const applyButtons = screen.getAllByRole("button", { name: "Apply file" });
    fireEvent.click(applyButtons[0]!);
    expect(drums.state.doc.toString()).toBe('s("bd sd")');
    expect(bass.state.doc.toString()).toBe('note("c2")');
    await waitFor(() => expect(screen.getByText("Ready to review")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "Apply file" })[1]!);
    expect(bass.state.doc.toString()).toBe('note("d2")');
    await waitFor(() =>
      expect(document.querySelector(".jam-chat-proposal-status")).toHaveTextContent("Applied"),
    );
  });
});
