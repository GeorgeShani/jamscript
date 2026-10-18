import { describe, expect, it } from "vitest";
import {
  deleteChatThread,
  listChatThreads,
  newChatThread,
  saveChatThread,
  trimChatMessages,
} from "@/features/assistant/chat-store";

describe("chat persistence", () => {
  it("trims history and keeps the newest thirty workspace chats", async () => {
    expect(trimChatMessages([1, 2, 3, 4], 3)).toEqual([2, 3, 4]);
    const workspaceId = crypto.randomUUID();
    const saved = [];
    for (let index = 0; index < 32; index++) {
      const thread = newChatThread(workspaceId, `Chat ${index}`);
      thread.messages = [
        {
          id: crypto.randomUUID(),
          role: "user",
          content: `hello ${index}`,
          createdAt: Date.now() + index,
        },
      ];
      saved.push(await saveChatThread(thread));
    }
    const listed = await listChatThreads(workspaceId);
    expect(listed).toHaveLength(30);
    expect(listed[0]?.title).toBe("Chat 31");
    await deleteChatThread(listed[0]!.id);
    expect(await listChatThreads(workspaceId)).toHaveLength(29);
    expect(JSON.stringify(listed)).not.toMatch(/api[_-]?key|sk_|re_/i);
  });
});
