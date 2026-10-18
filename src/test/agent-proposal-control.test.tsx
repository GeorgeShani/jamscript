import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentProposalControl } from "@/features/assistant/AgentProposalControl";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("agent proposal review", () => {
  it("shows a configured proposal, refuses stale apply, and allows a fresh reviewed apply", async () => {
    const proposal = {
      summary: "Add a rest",
      files: [
        {
          documentId: "song",
          name: "song.js",
          baseSource: 's("bd")',
          proposedSource: 's("bd ~")',
          explanation: "Leave space after the kick",
        },
      ],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ available: true }) })
      .mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => proposal });
    vi.stubGlobal("fetch", fetcher);
    const onApply = vi.fn().mockReturnValue(true);
    const onReveal = vi.fn();
    const ui = render(
      <AgentProposalControl
        documentId="song"
        sources={[{ id: "song", source: 's("bd")' }]}
        onReveal={onReveal}
        onApply={onApply}
      />,
    );
    fireEvent.click(await screen.findByText("Ask Gemini"));
    fireEvent.change(screen.getByLabelText("Describe a change"), {
      target: { value: "Add a rest after the kick" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Propose change" }));
    expect(await screen.findByText("Add a rest")).toBeTruthy();
    expect(onReveal).toHaveBeenCalledWith(["song"]);
    expect(screen.getByRole("button", { name: "Apply reviewed change" })).toBeEnabled();
    ui.rerender(
      <AgentProposalControl
        documentId="song"
        sources={[{ id: "song", source: 's("sd")' }]}
        onReveal={onReveal}
        onApply={onApply}
      />,
    );
    expect(screen.getByRole("button", { name: "Apply reviewed change" })).toBeDisabled();
    ui.rerender(
      <AgentProposalControl
        documentId="song"
        sources={[{ id: "song", source: 's("bd")' }]}
        onReveal={onReveal}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply reviewed change" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(proposal));
  });

  it("reviews all proposed workspace files and blocks apply when either source changes", async () => {
    const proposal = {
      summary: "Coordinate drums and bass",
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
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ available: true }) })
      .mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => proposal });
    vi.stubGlobal("fetch", fetcher);
    const onApply = vi.fn().mockReturnValue(true);
    const onReveal = vi.fn();
    const sources = [
      { id: "drums", source: 's("bd")' },
      { id: "bass", source: 'note("c3")' },
    ];
    const ui = render(
      <AgentProposalControl
        documentId="drums"
        sources={sources}
        onReveal={onReveal}
        onApply={onApply}
      />,
    );
    fireEvent.click(await screen.findByText("Ask Gemini"));
    fireEvent.change(screen.getByLabelText("Describe a change"), {
      target: { value: "Coordinate drums and bass" },
    });
    fireEvent.change(screen.getByLabelText("Files to consider"), {
      target: { value: "workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Propose change" }));
    expect(await screen.findByText("Coordinate drums and bass")).toBeTruthy();
    expect(JSON.parse(fetcher.mock.calls[1]![1].body).scope).toBe("workspace");
    await waitFor(() => expect(onReveal).toHaveBeenCalledWith(["drums", "bass"]));
    expect(screen.getByRole("button", { name: "Apply reviewed changes" })).toBeEnabled();
    ui.rerender(
      <AgentProposalControl
        documentId="drums"
        sources={[sources[0]!, { id: "bass", source: 'note("e3")' }]}
        onReveal={onReveal}
        onApply={onApply}
      />,
    );
    expect(screen.getByRole("button", { name: "Apply reviewed changes" })).toBeDisabled();
  });

  it("shows streamed progress and applies only the final reviewed proposal", async () => {
    const proposal = {
      summary: "Add a rest",
      files: [
        {
          documentId: "song",
          name: "song.js",
          baseSource: 's("bd")',
          proposedSource: 's("bd ~")',
          explanation: "Add rest",
        },
      ],
    };
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('{"type":"progress","message":"Generating"}\n'));
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "proposal", proposal })}\n`));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ available: true }) })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "content-type": "application/x-ndjson" }),
          body: stream,
        }),
    );
    const onApply = vi.fn().mockReturnValue(true);
    render(
      <AgentProposalControl
        documentId="song"
        sources={[{ id: "song", source: 's("bd")' }]}
        onReveal={vi.fn()}
        onApply={onApply}
      />,
    );
    fireEvent.click(await screen.findByText("Ask Gemini"));
    fireEvent.change(screen.getByLabelText("Describe a change"), {
      target: { value: "Add a rest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Propose change" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply reviewed change" }));
    expect(onApply).toHaveBeenCalledWith(proposal);
  });
});
