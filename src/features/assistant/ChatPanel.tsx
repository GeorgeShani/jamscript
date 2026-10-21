import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { shareableDocumentName } from "@/features/collaboration/shareable";
import { apiUrl } from "@/lib/app-api";
import { ChatSurface } from "./ChatSurface";
import { branchChat } from "./chat-actions";
import { createNdjsonParser } from "./chat-stream";
import {
  deleteChatThread,
  listChatThreads,
  newChatThread,
  saveChatThread,
  trimChatMessages,
} from "./chat-store";
import { expandSlashPrompt, parseSlashCommand } from "./chat-slash";
import { ProposalCard } from "./ProposalCard";
import { applyReviewedProposal } from "./apply-proposal";
import type { ChangeProposal } from "./proposal";
import {
  CHAT_LIMITS,
  type ChatMessage,
  type ChatMode,
  type ChatScope,
  type ChatThread,
} from "./chat-types";

export function ChatPanel({
  workspaceId,
  documentId,
  documentName,
  documents,
  selection,
  problemsText,
  sources,
  views,
  canEdit,
  onReveal,
  onStopPlayback,
}: {
  workspaceId: string;
  documentId: string;
  documentName: string;
  documents: { id: string; name: string }[];
  selection: string;
  problemsText: string;
  sources: { id: string; source: string }[];
  views: Map<string, EditorView>;
  canEdit: (documentId: string) => boolean;
  onReveal: (documentIds: string[]) => void;
  onStopPlayback: () => void;
}) {
  const [available, setAvailable] = useState<"checking" | boolean>("checking");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ChatMode>("ask");
  const [scope, setScope] = useState<ChatScope>("active");
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [includeSelection, setIncludeSelection] = useState(true);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<{ ask: string[]; edit: string[] }>({ ask: [], edit: [] });
  const [preferredModels, setPreferredModels] = useState({ ask: "", edit: "" });
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserRef = useRef("");
  const deletedThreads = useRef(new Set<string>());
  const latestThread = useRef<ChatThread | null>(null);
  useEffect(() => {
    latestThread.current = thread;
  }, [thread]);
  useEffect(
    () => () => {
      const current = latestThread.current;
      if (current?.messages.length && !deletedThreads.current.has(current.id))
        void saveChatThread(current).catch(() => {});
    },
    [],
  );

  useEffect(() => {
    let current = true;
    void fetch(apiUrl("/api/agent-chat"))
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as {
              available: boolean;
              models?: { ask: string[]; edit: string[] };
            })
          : { available: false },
      )
      .then((body) => {
        if (current) {
          setAvailable(body.available);
          if (body.models && Array.isArray(body.models.ask) && Array.isArray(body.models.edit))
            setModels(body.models);
        }
      })
      .catch(() => {
        if (current) setAvailable(false);
      });
    return () => {
      current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (available !== true) return;
    let current = true;
    void listChatThreads(workspaceId)
      .then((items) => {
        if (!current) return;
        setThreads(items);
        setThread(items[0] ?? newChatThread(workspaceId));
      })
      .catch(() => {
        if (current) setThread(newChatThread(workspaceId));
      });
    return () => {
      current = false;
    };
  }, [available, workspaceId]);

  useEffect(() => {
    setIncludeSelection(!!selection);
  }, [selection, documentId]);

  useEffect(() => {
    if (!thread?.messages.length) return;
    const timer = setTimeout(() => {
      if (deletedThreads.current.has(thread.id)) return;
      void saveChatThread(thread)
        .then((saved) => {
          setThreads((current) => {
            const next = [saved, ...current.filter((item) => item.id !== saved.id)];
            return next.slice(0, 30);
          });
        })
        .catch(() => {
          setError("Could not save this conversation on your device. You can copy or export it.");
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [thread]);

  if (available === "checking" || (available && !thread)) {
    return (
      <div className="jam-chat-panel jam-chat-empty" role="status">
        Checking assistant availability…
      </div>
    );
  }
  if (!available) {
    return (
      <div className="jam-chat-panel jam-chat-empty" role="status">
        Assistant needs a server API key. Configure OPENROUTER_API_KEY and reload.
      </div>
    );
  }
  if (!thread) return null;

  const updateThread = (next: ChatThread | ((current: ChatThread) => ChatThread)) => {
    setThread((current) => {
      if (!current) return current;
      return typeof next === "function" ? next(current) : next;
    });
  };

  const markProposal = (messageId: string, status: "applied" | "rejected" | "stale") => {
    updateThread((current) => ({
      ...current,
      messages: current.messages.map((message) =>
        message.id === messageId && message.proposal
          ? { ...message, proposal: { ...message.proposal, status } }
          : message,
      ),
    }));
  };

  const applyProposal = (messageId: string, proposal: ChangeProposal) => {
    if (!proposal.files.length) return;
    const applied = applyReviewedProposal(proposal, views, canEdit);
    if (!applied) {
      markProposal(messageId, "stale");
      setError("The editor changed. Reject this proposal or ask again.");
      return;
    }
    onStopPlayback();
    updateThread((current) => ({
      ...current,
      messages: current.messages.map((message) => {
        if (message.id !== messageId || !message.proposal) return message;
        const appliedDocumentIds = [
          ...new Set([
            ...(message.proposal.appliedDocumentIds ?? []),
            ...proposal.files.map((file) => file.documentId),
          ]),
        ];
        return {
          ...message,
          proposal: {
            ...message.proposal,
            appliedDocumentIds,
            status:
              appliedDocumentIds.length === message.proposal.proposal.files.length
                ? ("applied" as const)
                : ("pending" as const),
          },
        };
      }),
    }));
    views.get(documentId)?.focus();
  };

  const send = async (
    text: string,
    regenerate = false,
    baseThread = thread,
    requestMode = mode,
  ) => {
    if (pending) return;
    const slash = parseSlashCommand(text);
    if (slash?.command === "clear") {
      const fresh = newChatThread(workspaceId);
      setThread(fresh);
      setDraft("");
      setError(null);
      return;
    }
    const content = slash
      ? expandSlashPrompt(slash.command, slash.rest, {
          selection,
          problems: problemsText,
        })
      : text.trim();
    if (!content) return;
    lastUserRef.current = content;
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      mode: requestMode,
    };
    // Failed turns leave empty assistant stubs; strip them so the next request validates.
    let history = baseThread.messages.filter(
      (message) => message.role === "user" || message.content.trim().length > 0,
    );
    if (regenerate) {
      if (history.at(-1)?.role === "assistant") history = history.slice(0, -1);
    } else {
      history = [
        ...history,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          createdAt: Date.now(),
        },
      ];
    }
    updateThread({
      ...baseThread,
      title:
        baseThread.messages.length || baseThread.title !== "New chat"
          ? baseThread.title
          : content.slice(0, 48),
      messages: [...history, assistantMessage],
    });
    setDraft("");
    setError(null);
    setPending(true);
    setStatus("Starting…");
    requestAnimationFrame(() => {
      composerRef.current?.focus();
    });

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const attachedDocumentIds = [documentId, ...attachedIds.filter((id) => id !== documentId)];
      const eligibleDocuments = documents.filter((file) => shareableDocumentName(file.name));
      const fileIds =
        scope === "workspace"
          ? [
              documentId,
              ...eligibleDocuments.map((file) => file.id).filter((id) => id !== documentId),
            ]
          : attachedDocumentIds.length
            ? attachedDocumentIds
            : [documentId];
      const files = fileIds
        .map((id) => {
          const meta = eligibleDocuments.find((file) => file.id === id);
          const source = sources.find((file) => file.id === id)?.source;
          if (!meta || source === undefined) return null;
          return { id, name: meta.name, source };
        })
        .filter((file): file is { id: string; name: string; source: string } => !!file)
        .slice(0, 8);
      const response = await fetch(apiUrl("/api/agent-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        signal: controller.signal,
        body: JSON.stringify({
          threadId: baseThread.id,
          documentId,
          mode: requestMode,
          ...(preferredModels[requestMode] ? { model: preferredModels[requestMode] } : {}),
          scope,
          messages: trimChatMessages(history)
            .filter((message) => message.content.trim().length > 0)
            .map(({ role, content: body }) => ({
              role,
              content: body.slice(0, CHAT_LIMITS.maxMessageChars),
            })),
          ...(includeSelection && selection ? { selection } : {}),
          ...(attachedDocumentIds.length ? { attachedDocumentIds } : {}),
          files,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message =
          response.status === 429
            ? (body?.error ?? "Chat limit reached. Try again in a minute.")
            : response.status === 403
              ? "Editing access required"
              : (body?.error ?? "The assistant is unavailable");
        throw new Error(message);
      }
      if (!response.body) throw new Error("The assistant returned an empty stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createNdjsonParser((event) => {
        if (controller.signal.aborted) return;
        if (event.type === "status") setStatus(event.message);
        if (event.type === "text-delta") {
          updateThread((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + event.text }
                : message,
            ),
          }));
        }
        if (event.type === "proposal" && requestMode === "edit") {
          updateThread((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    proposal: { proposal: event.proposal, status: "pending" },
                  }
                : message,
            ),
          }));
          onReveal(event.proposal.files.map((file) => file.documentId));
        }
        if (event.type === "done") {
          const seenDocumentIds = event.seenDocumentIds;
          updateThread((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === assistantId
                ? seenDocumentIds
                  ? { ...message, seenDocumentIds }
                  : message
                : message,
            ),
          }));
        }
        if (event.type === "error") throw new Error(event.message);
      });
      for (;;) {
        if (controller.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      if (!controller.signal.aborted) parser.flush();
    } catch (cause) {
      if (abortRef.current !== controller) return;
      if (controller.signal.aborted) {
        setError("Generation stopped.");
      } else {
        const message =
          cause instanceof TypeError
            ? "You appear offline. Check your connection and retry."
            : cause instanceof Error
              ? cause.message
              : "The assistant failed";
        setError(message);
        updateThread((current) => ({
          ...current,
          messages: current.messages.map((item) =>
            item.id === assistantId ? { ...item, error: message } : item,
          ),
        }));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setPending(false);
        setStatus(null);
      }
      composerRef.current?.focus();
    }
  };

  const lastAssistant = [...thread.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const bannerError = error && lastAssistant?.error !== error ? error : null;
  const remember = () => {
    if (!thread.messages.length) return;
    void saveChatThread(thread)
      .then((saved) =>
        setThreads((items) =>
          [saved, ...items.filter((item) => item.id !== saved.id)].slice(0, 30),
        ),
      )
      .catch(() => setError("Could not save this conversation on your device."));
  };
  const switchThread = (next: ChatThread) => {
    remember();
    setThread(next);
    setDraft("");
    setError(null);
    lastUserRef.current =
      [...next.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  };
  const retry = (message: ChatMessage) => {
    const position = thread.messages.findIndex((item) => item.id === message.id);
    const user = thread.messages
      .slice(0, position + 1)
      .reverse()
      .find((item) => item.role === "user");
    if (!user) return;
    const retryMode = message.mode ?? mode;
    setMode(retryMode);
    if (message.id === lastAssistant?.id) void send(user.content, true, thread, retryMode);
    else {
      remember();
      void send(user.content, false, branchChat(thread, user.id), retryMode);
    }
  };
  return (
    <ChatSurface
      thread={thread}
      threads={threads}
      pending={pending}
      status={status}
      error={bannerError}
      draft={draft}
      onDraft={setDraft}
      mode={mode}
      onMode={setMode}
      scope={scope}
      onScope={setScope}
      canEdit={canEdit(documentId)}
      documentId={documentId}
      documentName={documentName}
      documents={documents}
      attachedIds={attachedIds}
      onAttach={(id) => setAttachedIds((items) => [...new Set([...items, id])])}
      onDetach={(id) => setAttachedIds((items) => items.filter((item) => item !== id))}
      selection={selection}
      includeSelection={includeSelection}
      onSelection={setIncludeSelection}
      hasSource={!!sources.find((file) => file.id === documentId)?.source.trim()}
      models={models}
      model={preferredModels[mode]}
      onModel={(model) => setPreferredModels((current) => ({ ...current, [mode]: model }))}
      composerRef={composerRef}
      onSend={(text) => void send(text)}
      onStop={() => abortRef.current?.abort()}
      onNew={() => switchThread(newChatThread(workspaceId))}
      onSelect={switchThread}
      onRename={(title) => updateThread((current) => ({ ...current, title }))}
      onDelete={() => {
        const id = thread.id;
        deletedThreads.current.add(id);
        void deleteChatThread(id)
          .then(() => {
            setThreads((items) => items.filter((item) => item.id !== id));
            setThread(newChatThread(workspaceId));
            setError(null);
          })
          .catch(() => {
            deletedThreads.current.delete(id);
            setError("Could not delete this conversation.");
          });
      }}
      onError={setError}
      onRetry={retry}
      onEdit={(message, text) => {
        remember();
        void send(text, false, branchChat(thread, message.id));
      }}
      onBranch={(message) => {
        const position = thread.messages.findIndex((item) => item.id === message.id);
        switchThread({
          ...newChatThread(workspaceId, `${thread.title.slice(0, 60)} · branch`),
          messages: thread.messages.slice(0, position + 1),
        });
      }}
      renderProposal={(message) =>
        message.proposal ? (
          <ProposalCard
            proposal={message.proposal.proposal}
            status={
              message.proposal.status === "pending" &&
              !message.proposal.proposal.files
                .filter((file) => !message.proposal?.appliedDocumentIds?.includes(file.documentId))
                .every((file) =>
                  sources.some(
                    (source) => source.id === file.documentId && source.source === file.baseSource,
                  ),
                )
                ? "stale"
                : message.proposal.status
            }
            appliedDocumentIds={message.proposal.appliedDocumentIds ?? []}
            sources={sources}
            onApplyAll={() =>
              applyProposal(message.id, {
                ...message.proposal!.proposal,
                files: message.proposal!.proposal.files.filter(
                  (file) => !message.proposal!.appliedDocumentIds?.includes(file.documentId),
                ),
              })
            }
            onApplyFile={(id) => {
              const file = message.proposal!.proposal.files.find((item) => item.documentId === id);
              if (file)
                applyProposal(message.id, {
                  summary: message.proposal!.proposal.summary,
                  files: [file],
                });
            }}
            onReject={() => markProposal(message.id, "rejected")}
            onReveal={onReveal}
          />
        ) : null
      }
    />
  );
}
