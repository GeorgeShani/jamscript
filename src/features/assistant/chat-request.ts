import { CHAT_LIMITS, type AgentChatRequest, type ChatMode, type ChatScope } from "./chat-types";

export function parseAgentChatRequest(body: unknown): AgentChatRequest {
  if (!body || typeof body !== "object") throw new Error("Invalid request");
  const value = body as Record<string, unknown>;
  if (typeof value.threadId !== "string" || !value.threadId.trim())
    throw new Error("Choose a chat thread");
  if (typeof value.documentId !== "string" || !value.documentId.trim())
    throw new Error("Choose a document");
  if (value.mode !== "ask" && value.mode !== "edit") throw new Error("Choose Ask or Edit mode");
  if (value.scope !== "active" && value.scope !== "workspace")
    throw new Error("Choose an Edit scope");
  if (!Array.isArray(value.messages) || !value.messages.length)
    throw new Error("Send at least one message");
  if (value.messages.length > CHAT_LIMITS.maxMessages) throw new Error("Chat history is too long");
  const messages = value.messages.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid chat message");
    const message = item as { role?: unknown; content?: unknown };
    if (
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > CHAT_LIMITS.maxMessageChars
    )
      throw new Error("Invalid chat message");
    return { role: message.role, content: message.content };
  });
  if (messages.at(-1)?.role !== "user") throw new Error("The latest message must be from you");
  let selection: string | undefined;
  if (value.selection !== undefined) {
    if (typeof value.selection !== "string" || value.selection.length > CHAT_LIMITS.maxSelectionChars)
      throw new Error("Selection is too large");
    selection = value.selection;
  }
  let attachedDocumentIds: string[] | undefined;
  if (value.attachedDocumentIds !== undefined) {
    if (
      !Array.isArray(value.attachedDocumentIds) ||
      value.attachedDocumentIds.length > CHAT_LIMITS.maxAttachedFiles ||
      value.attachedDocumentIds.some((id) => typeof id !== "string" || !id)
    )
      throw new Error("Too many attached files");
    attachedDocumentIds = [...new Set(value.attachedDocumentIds as string[])];
  }
  return {
    threadId: value.threadId.trim(),
    documentId: value.documentId,
    mode: value.mode as ChatMode,
    scope: value.scope as ChatScope,
    messages,
    ...(selection ? { selection } : {}),
    ...(attachedDocumentIds?.length ? { attachedDocumentIds } : {}),
  };
}
