import { newChatThread } from "./chat-store";
import type { ChatThread } from "./chat-types";

export function branchChat(thread: ChatThread, messageId: string) {
  const index = thread.messages.findIndex((message) => message.id === messageId);
  if (index < 0) throw new Error("Message no longer exists");
  return {
    ...newChatThread(thread.workspaceId, `${thread.title.slice(0, 60)} · branch`),
    messages: thread.messages.slice(0, index),
  };
}

export function chatMarkdown(thread: ChatThread) {
  return [
    `# ${thread.title}`,
    ...thread.messages.map(
      (message) =>
        `## ${message.role === "user" ? "You" : "JamScript"}\n\n${message.content}${message.error ? `\n\nError: ${message.error}` : ""}${message.proposal ? `\n\n${message.proposal.proposal.files.map((file) => `### ${file.name}\n\n\x60\x60\x60js\n${file.proposedSource}\n\x60\x60\x60`).join("\n\n")}` : ""}`,
    ),
  ].join("\n\n");
}

export function downloadChat(thread: ChatThread) {
  const url = URL.createObjectURL(
    new Blob([chatMarkdown(thread)], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    thread.title
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .slice(0, 70) || "jamscript-chat"
  }.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function modelName(id: string) {
  return (
    id
      .split("/")
      .at(-1)
      ?.replace(/^gpt-/, "GPT ")
      .replace(/^claude-/, "Claude ")
      .replace(/^gemini-/, "Gemini ")
      .replaceAll("-", " ") ?? id
  );
}
