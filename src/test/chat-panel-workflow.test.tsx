import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "@/features/assistant/ChatPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("assistant chat workflow", () => {
  it("keeps Ask available to a viewer while disabling Edit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ available: true })),
    );
    render(
      <ChatPanel
        workspaceId={`viewer-test-${crypto.randomUUID()}`}
        documentId="song"
        documentName="song.js"
        documents={[{ id: "song", name: "song.js" }]}
        selection=""
        problemsText=""
        sources={[{ id: "song", source: 's("bd")' }]}
        views={new Map()}
        canEdit={() => false}
        onReveal={() => undefined}
        onStopPlayback={() => undefined}
      />,
    );
    expect(await screen.findByRole("button", { name: "Ask" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.queryByText(/Editing requires editor access/)).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole("button", { name: "Assistant mode help" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/Editing requires editor access/);
  });

  it("answers with workspace context and carries the question into a reviewed edit", async () => {
    let requestBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init) return Response.json({ available: true });
        requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          `${JSON.stringify({ type: "text-delta", text: 'The kick plays on the first step.\n\n```js\ns("bd")\n```' })}\n${JSON.stringify({ type: "done", seenDocumentIds: ["drums", "bass"] })}\n`,
          { headers: { "Content-Type": "application/x-ndjson" } },
        );
      }),
    );
    render(
      <ChatPanel
        workspaceId={`chat-test-${crypto.randomUUID()}`}
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
        views={new Map()}
        canEdit={() => true}
        onReveal={() => undefined}
        onStopPlayback={() => undefined}
      />,
    );
    await screen.findByRole("textbox", { name: "Message the assistant" });
    fireEvent.change(screen.getByLabelText("Files in assistant context"), {
      target: { value: "workspace" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Message the assistant" }), {
      target: { value: "How does the kick relate to the bass?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("The kick plays on the first step.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insert at cursor" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(requestBody?.["files"]).toEqual([
        { id: "drums", name: "drums.js", source: 's("bd")' },
        { id: "bass", name: "bass.js", source: 'note("c2")' },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Propose an edit for this request" }));
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Message the assistant" })).toHaveValue(
      "How does the kick relate to the bass?",
    );
  });
});
