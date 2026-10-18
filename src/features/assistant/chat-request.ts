import {
  CHAT_LIMITS,
  type AgentChatRequest,
  type ChatMode,
  type ChatRole,
  type ChatScope,
} from "./chat-types";

export function parseAgentChatRequest(body: unknown): AgentChatRequest {
  if (!body || typeof body !== "object") throw new Error("Invalid request");
  const value = body as Record<string, unknown>;
  const threadId = value["threadId"];
  const documentId = value["documentId"];
  const mode = value["mode"];
  const scope = value["scope"];
  const rawMessages = value["messages"];
  if (typeof threadId !== "string" || !threadId.trim()) throw new Error("Choose a chat thread");
  if (typeof documentId !== "string" || !documentId.trim()) throw new Error("Choose a document");
  if (mode !== "ask" && mode !== "edit") throw new Error("Choose Ask or Edit mode");
  if (scope !== "active" && scope !== "workspace") throw new Error("Choose an Edit scope");
  if (!Array.isArray(rawMessages) || !rawMessages.length)
    throw new Error("Send at least one message");
  if (rawMessages.length > CHAT_LIMITS.maxMessages) throw new Error("Chat history is too long");
  // Drop empty assistant stubs left by failed turns so the next send still validates.
  const messages: { role: ChatRole; content: string }[] = [];
  for (const item of rawMessages) {
    if (!item || typeof item !== "object") throw new Error("Invalid chat message");
    const message = item as Record<string, unknown>;
    const role = message["role"];
    const content = message["content"];
    if (role !== "user" && role !== "assistant") throw new Error("Invalid chat message");
    if (typeof content !== "string" || content.length > CHAT_LIMITS.maxMessageChars)
      throw new Error("Invalid chat message");
    if (!content.trim()) continue;
    messages.push({ role, content });
  }
  if (!messages.length) throw new Error("Send at least one message");
  if (messages.at(-1)?.role !== "user") throw new Error("The latest message must be from you");
  let selection: string | undefined;
  const rawSelection = value["selection"];
  if (rawSelection !== undefined) {
    if (typeof rawSelection !== "string" || rawSelection.length > CHAT_LIMITS.maxSelectionChars)
      throw new Error("Selection is too large");
    selection = rawSelection;
  }
  let attachedDocumentIds: string[] | undefined;
  const rawAttached = value["attachedDocumentIds"];
  if (rawAttached !== undefined) {
    if (
      !Array.isArray(rawAttached) ||
      rawAttached.length > CHAT_LIMITS.maxAttachedFiles ||
      rawAttached.some((id) => typeof id !== "string" || !id)
    )
      throw new Error("Too many attached files");
    attachedDocumentIds = [...new Set(rawAttached as string[])];
  }
  return {
    threadId: threadId.trim(),
    documentId,
    mode: mode as ChatMode,
    scope: scope as ChatScope,
    messages,
    ...(selection ? { selection } : {}),
    ...(attachedDocumentIds?.length ? { attachedDocumentIds } : {}),
  };
}
