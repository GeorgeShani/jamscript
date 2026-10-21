import { expect, it } from "vitest";
import { branchChat, chatMarkdown } from "@/features/assistant/chat-actions";
import { newChatThread } from "@/features/assistant/chat-store";

it("branches before an edited message without mutating the original transcript", () => {
  const original = {
    ...newChatThread("workspace", "Groove"),
    messages: [
      { id: "first", role: "user" as const, content: "hello", createdAt: 1 },
      { id: "reply", role: "assistant" as const, content: "hi", createdAt: 2 },
      { id: "edit", role: "user" as const, content: "change", createdAt: 3 },
    ],
  };
  const branch = branchChat(original, "edit");
  expect(branch.id).not.toBe(original.id);
  expect(branch.messages.map((message) => message.id)).toEqual(["first", "reply"]);
  expect(original.messages).toHaveLength(3);
  expect(() => branchChat(original, "missing")).toThrow();
});

it("exports messages and reviewable code as Markdown", () => {
  const thread = {
    ...newChatThread("workspace", "Drum ideas"),
    messages: [
      {
        id: "reply",
        role: "assistant" as const,
        content: "A quieter kick",
        createdAt: 2,
        proposal: {
          status: "pending" as const,
          proposal: {
            summary: "Lower gain",
            files: [
              {
                documentId: "song",
                name: "song.js",
                baseSource: 's("bd")',
                proposedSource: 's("bd").gain(0.4)',
                explanation: "Quieter",
              },
            ],
          },
        },
      },
    ],
  };
  expect(chatMarkdown(thread)).toContain("# Drum ideas");
  expect(chatMarkdown(thread)).toContain('### song.js\n\n```js\ns("bd").gain(0.4)\n```');
});
