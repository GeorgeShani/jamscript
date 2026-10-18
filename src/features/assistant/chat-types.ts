import type { ChangeProposal } from "./proposal";

export type ChatMode = "ask" | "edit";
export type ChatScope = "active" | "workspace";

export type ChatRole = "user" | "assistant";

export type ProposalStatus = "pending" | "applied" | "rejected" | "stale";

export interface ChatProposalState {
  proposal: ChangeProposal;
  status: ProposalStatus;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  error?: string;
  proposal?: ChatProposalState;
  /** Document ids the server included in context for this turn. */
  seenDocumentIds?: string[];
}

export interface ChatThread {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export type AgentChatEvent =
  | { type: "status"; message: string }
  | { type: "text-delta"; text: string }
  | { type: "proposal"; proposal: ChangeProposal }
  | { type: "done"; seenDocumentIds?: string[] }
  | { type: "error"; message: string };

export interface AgentChatFile {
  id: string;
  name: string;
  source: string;
}

export interface AgentChatRequest {
  threadId: string;
  messages: { role: ChatRole; content: string }[];
  mode: ChatMode;
  scope: ChatScope;
  documentId: string;
  selection?: string;
  attachedDocumentIds?: string[];
  /** Client-owned sources for local (non-shared) workspaces. */
  files?: AgentChatFile[];
}

export const CHAT_LIMITS = {
  maxMessages: 24,
  maxMessageChars: 4_000,
  maxSelectionChars: 4_000,
  maxAttachedFiles: 8,
  maxFileChars: 100_000,
  maxTotalSourceChars: 160_000,
  maxResponseChars: 500_000,
} as const;
