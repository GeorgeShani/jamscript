import { describe, expect, it, vi } from "vitest";
import { createNdjsonParser, extractTrailingJson } from "@/features/assistant/chat-stream";
import { parseAgentChatRequest } from "@/features/assistant/chat-request";
import { CHAT_LIMITS } from "@/features/assistant/chat-types";

describe("agent chat NDJSON parsing", () => {
  it("reassembles events split across chunk boundaries", () => {
    const events: unknown[] = [];
    const parser = createNdjsonParser((event) => events.push(event));
    parser.push('{"type":"status","message":"Reading');
    parser.push(' files"}\n{"type":"text-delta","tex');
    parser.push('t":"Hello"}\n');
    parser.push('{"type":"done"}\n');
    expect(events).toEqual([
      { type: "status", message: "Reading files" },
      { type: "text-delta", text: "Hello" },
      { type: "done" },
    ]);
  });

  it("flushes a final line without a trailing newline", () => {
    const events: unknown[] = [];
    const parser = createNdjsonParser((event) => events.push(event));
    parser.push('{"type":"error","message":"aborted"}');
    parser.flush();
    expect(events).toEqual([{ type: "error", message: "aborted" }]);
  });
});

describe("agent chat request bounds", () => {
  it("accepts a bounded Ask turn and rejects oversized history", () => {
    expect(
      parseAgentChatRequest({
        threadId: "t1",
        documentId: "doc",
        mode: "ask",
        scope: "active",
        messages: [{ role: "user", content: "Explain the kick" }],
        selection: 's("bd")',
      }),
    ).toMatchObject({ mode: "ask", selection: 's("bd")' });
    expect(
      parseAgentChatRequest({
        threadId: "t1",
        documentId: "doc",
        mode: "ask",
        scope: "active",
        messages: [
          { role: "user", content: "Explain" },
          { role: "assistant", content: "" },
          { role: "user", content: "Hi" },
        ],
      }),
    ).toMatchObject({
      messages: [
        { role: "user", content: "Explain" },
        { role: "user", content: "Hi" },
      ],
    });
    expect(() =>
      parseAgentChatRequest({
        threadId: "t1",
        documentId: "doc",
        mode: "ask",
        scope: "active",
        messages: Array.from({ length: CHAT_LIMITS.maxMessages + 1 }, (_, index) => ({
          role: index % 2 === 0 ? "user" : "assistant",
          content: `m${index}`,
        })),
      }),
    ).toThrow(/too long/);
  });

  it("requires the latest message to be from the user", () => {
    expect(() =>
      parseAgentChatRequest({
        threadId: "t1",
        documentId: "doc",
        mode: "edit",
        scope: "workspace",
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
        ],
      }),
    ).toThrow(/latest message/);
  });
});

describe("trailing proposal JSON extraction", () => {
  it("splits narrative from a fenced JSON proposal", () => {
    const parsed = extractTrailingJson(
      'Here is a quieter hat.\n\n```json\n{"summary":"Quieter","files":[]}\n```',
    );
    expect(parsed?.narrative).toContain("quieter hat");
    expect(parsed?.json).toEqual({ summary: "Quieter", files: [] });
  });
});

describe("abort mid-stream", () => {
  it("stops consuming after the client aborts", async () => {
    const controller = new AbortController();
    const chunks = ['{"type":"text-delta","text":"a"}\n', '{"type":"text-delta","text":"b"}\n'];
    const received: string[] = [];
    const decoder = new TextDecoder();
    const parser = createNdjsonParser((event) => {
      if (event.type === "text-delta") received.push(event.text);
    });
    for (const chunk of chunks) {
      if (controller.signal.aborted) break;
      parser.push(decoder.decode(new TextEncoder().encode(chunk), { stream: true }));
      if (received.includes("a")) controller.abort();
    }
    expect(received).toEqual(["a"]);
    expect(controller.signal.aborted).toBe(true);
  });
});
