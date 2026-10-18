import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChatPanel } from "@/features/assistant/ChatPanel";

describe("ChatPanel availability (G / AGENTS honesty)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ available: false }),
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("explains when the agent is unavailable instead of rendering a fake thread", async () => {
    render(
      <ChatPanel
        workspaceId="ws-1"
        documentId="doc-1"
        documentName="song.js"
        documents={[{ id: "doc-1", name: "song.js" }]}
        selection=""
        problemsText=""
        sources={[{ id: "doc-1", source: 's("bd")' }]}
        views={new Map()}
        canEdit={() => true}
        onReveal={() => undefined}
        onStopPlayback={() => undefined}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Checking assistant/i);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/GEMINI_API_KEY/i));
    expect(screen.queryByLabelText("Chat history")).toBeNull();
    expect(screen.queryByRole("log")).toBeNull();
  });
});
