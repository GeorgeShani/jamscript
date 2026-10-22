import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChatPanel } from "@/features/assistant/ChatPanel";
import { listChatThreads } from "@/features/assistant/chat-store";

const requests: Record<string, unknown>[] = [];
const copy = vi.fn().mockResolvedValue(undefined);
let workspaceId: string;
beforeEach(() => {
  workspaceId = crypto.randomUUID();
  requests.length = 0;
  vi.stubGlobal(
    "navigator",
    Object.assign(Object.create(navigator), { clipboard: { writeText: copy } }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (!init)
        return Response.json({
          available: true,
          models: {
            ask: ["openai/gpt-6-luna", "anthropic/claude-sonnet-5.5"],
            edit: ["openai/gpt-6-sol"],
          },
        });
      requests.push(JSON.parse(String(init.body)));
      return new Response(
        `${JSON.stringify({ type: "text-delta", text: `Answer ${requests.length}: play a steady kick.` })}\n${JSON.stringify({ type: "done", seenDocumentIds: ["song"] })}\n`,
      );
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function open() {
  render(
    <ChatPanel
      workspaceId={workspaceId}
      documentId="song"
      documentName="song.js"
      documents={[
        { id: "song", name: "song.js" },
        { id: "bass", name: "bass.js" },
      ]}
      selection=""
      problemsText=""
      sources={[
        { id: "song", source: 's("bd")' },
        { id: "bass", source: 'note("c2")' },
      ]}
      views={new Map()}
      canEdit={() => true}
      onReveal={() => {}}
      onStopPlayback={() => {}}
    />,
  );
  await screen.findByRole("textbox", { name: "Message the assistant" });
}
async function send(text = "Explain this kick") {
  fireEvent.change(screen.getByRole("textbox", { name: "Message the assistant" }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText(`Answer ${requests.length}: play a steady kick.`);
  await waitFor(() => expect(screen.getByRole("button", { name: "New chat" })).toBeEnabled());
}

it("sends the selected allowlisted model and attached workspace file", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Choose assistant model" }));
  fireEvent.click(await screen.findByRole("option", { name: /Claude/i }));
  fireEvent.click(screen.getByRole("button", { name: "Attach workspace files" }));
  fireEvent.click(await screen.findByRole("option", { name: "bass.js" }));
  await send();
  expect(requests[0]).toMatchObject({
    model: "anthropic/claude-sonnet-5.5",
    attachedDocumentIds: ["song", "bass"],
  });
  expect(requests[0]!["files"]).toHaveLength(2);
});

it("edits an earlier prompt into a branch and keeps the original chat searchable", async () => {
  await open();
  await send("Original kick question");
  fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Edit your message" }), {
    target: { value: "Revised kick question" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save & send" }));
  await screen.findByText("Answer 2: play a steady kick.");
  expect(requests[1]!["messages"]).toEqual([{ role: "user", content: "Revised kick question" }]);
  await waitFor(async () => expect(await listChatThreads(workspaceId)).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: "Chat history" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Search chats" }), {
    target: { value: "Original kick question" },
  });
  expect(
    screen.getByRole("button", { name: /Original kick question Answer 1/ }),
  ).toBeInTheDocument();
});

it("renames and confirms deletion without a delayed autosave restoring the chat", async () => {
  await open();
  await send();
  fireEvent.click(screen.getByRole("button", { name: "Conversation actions" }));
  fireEvent.click(await screen.findByRole("button", { name: "Rename" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Conversation title" }), {
    target: { value: "Kick ideas" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  expect(await screen.findByText("Kick ideas")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Conversation actions" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete conversation" }));
  expect(screen.getByText("Delete this conversation?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete conversation" }));
  await screen.findByText("What are we playing today?");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
  expect(await listChatThreads(workspaceId)).toHaveLength(0);
});

it("copies replies and regenerates an Ask response in Ask mode after switching to Edit", async () => {
  await open();
  await send();
  fireEvent.click(screen.getAllByRole("button", { name: "Copy message" })[1]!);
  await waitFor(() => expect(copy).toHaveBeenCalledWith("Answer 1: play a steady kick."));
  expect(screen.getByRole("button", { name: "Copied message" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Regenerate response" }));
  await screen.findByText("Answer 2: play a steady kick.");
  expect(requests[1]!["mode"]).toBe("ask");
  expect(requests[1]!["messages"]).toEqual([{ role: "user", content: "Explain this kick" }]);
});

it("stops an active stream and keeps its partial answer", async () => {
  await open();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (_url: unknown, init?: RequestInit) =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  `${JSON.stringify({ type: "text-delta", text: "A partial answer" })}\n`,
                ),
              );
              init?.signal?.addEventListener(
                "abort",
                () => controller.error(new DOMException("Stopped", "AbortError")),
                { once: true },
              );
            },
          }),
        ),
    ),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Message the assistant" }), {
    target: { value: "Explain the track" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("A partial answer");
  fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
  await screen.findByText("Generation stopped.");
  expect(screen.getByText("A partial answer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New chat" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Stop generating" })).not.toBeInTheDocument();
});

it("deletes another conversation from history without switching or losing the active draft", async () => {
  await open();
  await send("First idea");
  fireEvent.click(screen.getByRole("button", { name: "New chat" }));
  await send("Second idea");
  await waitFor(async () => expect(await listChatThreads(workspaceId)).toHaveLength(2));
  fireEvent.change(screen.getByRole("textbox", { name: "Message the assistant" }), {
    target: { value: "Keep my draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Chat history" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete First idea" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(await listChatThreads(workspaceId)).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Delete First idea" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete conversation" }));
  await waitFor(async () =>
    expect((await listChatThreads(workspaceId)).map((item) => item.title)).toEqual(["Second idea"]),
  );
  expect(screen.queryByRole("button", { name: "Delete First idea" })).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Message the assistant" })).toHaveValue(
    "Keep my draft",
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  cleanup();
  await open();
  expect(await screen.findByText("Answer 2: play a steady kick.")).toBeInTheDocument();
  expect((await listChatThreads(workspaceId)).map((item) => item.title)).toEqual(["Second idea"]);
});
