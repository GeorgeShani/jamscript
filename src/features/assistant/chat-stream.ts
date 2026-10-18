import type { AgentChatEvent } from "./chat-types";

/** Parse NDJSON lines across chunk boundaries. Incomplete trailing lines stay buffered. */
export function createNdjsonParser(onEvent: (event: AgentChatEvent) => void) {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) onEvent(JSON.parse(line) as AgentChatEvent);
        newline = buffer.indexOf("\n");
      }
    },
    flush() {
      const line = buffer.trim();
      buffer = "";
      if (line) onEvent(JSON.parse(line) as AgentChatEvent);
    },
  };
}

/** Extract a trailing fenced JSON object from streamed assistant output. */
export function extractTrailingJson(text: string): { narrative: string; json: unknown } | null {
  const fence = /```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(text);
  if (fence?.[1]) {
    try {
      return {
        narrative: text.slice(0, fence.index).trimEnd(),
        json: JSON.parse(fence[1]),
      };
    } catch {
      return null;
    }
  }
  const start = text.lastIndexOf("{");
  if (start < 0) return null;
  try {
    return {
      narrative: text.slice(0, start).trimEnd(),
      json: JSON.parse(text.slice(start)),
    };
  } catch {
    return null;
  }
}
