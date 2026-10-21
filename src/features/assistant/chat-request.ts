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
  const model = value["model"];
  if (
    model !== undefined &&
    (typeof model !== "string" || model.length > 160 || !/^[\w.-]+\/[\w.:-]+$/.test(model))
  )
    throw new Error("Choose an available assistant model");
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
  let files: { id: string; name: string; source: string }[] | undefined;
  const rawFiles = value["files"];
  if (rawFiles !== undefined) {
    if (!Array.isArray(rawFiles) || rawFiles.length > CHAT_LIMITS.maxAttachedFiles)
      throw new Error("Too many attached files");
    files = [];
    for (const item of rawFiles) {
      if (!item || typeof item !== "object") throw new Error("Invalid file payload");
      const file = item as Record<string, unknown>;
      const id = file["id"];
      const name = file["name"];
      const source = file["source"];
      if (typeof id !== "string" || !id.trim()) throw new Error("Invalid file payload");
      if (typeof name !== "string" || !name.trim() || name.length > 120)
        throw new Error("Invalid file payload");
      if (typeof source !== "string" || source.length > CHAT_LIMITS.maxFileChars)
        throw new Error("A file is too large for chat");
      files.push({ id, name, source });
    }
  }
  return {
    threadId: threadId.trim(),
    documentId,
    mode: mode as ChatMode,
    scope: scope as ChatScope,
    messages,
    ...(typeof model === "string" ? { model } : {}),
    ...(selection ? { selection } : {}),
    ...(attachedDocumentIds?.length ? { attachedDocumentIds } : {}),
    ...(files?.length ? { files } : {}),
  };
}
