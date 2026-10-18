import { useEffect, useId, useRef, useState } from "react";
import { isolateHistory } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Button } from "@/components/ui/button";
import { ChatMarkdown } from "./chat-markdown";
import { createNdjsonParser } from "./chat-stream";
import {
  deleteChatThread,
  listChatThreads,
  newChatThread,
  saveChatThread,
  trimChatMessages,
} from "./chat-store";
import {
  EDIT_STARTER_PROMPTS,
  expandSlashPrompt,
  NEW_SONG_PROMPTS,
  parseSlashCommand,
  STARTER_PROMPTS,
} from "./chat-slash";
import { ProposalCard } from "./ProposalCard";
import { applyReviewedProposal } from "./apply-proposal";
import type { ChangeProposal } from "./proposal";
import type { ChatMessage, ChatMode, ChatScope, ChatThread } from "./chat-types";

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
  const [includeActive, setIncludeActive] = useState(true);
  const [includeSelection, setIncludeSelection] = useState(true);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserRef = useRef("");
  const seenLabelId = useId();

  useEffect(() => {
    let current = true;
    void fetch("/api/agent-chat")
      .then(async (response) =>
        response.ok ? ((await response.json()) as { available: boolean }) : { available: false },
      )
      .then((body) => {
        if (current) setAvailable(body.available);
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
    if (!thread) return;
    void saveChatThread(thread)
      .then((saved) => {
        setThreads((current) => {
          const next = [saved, ...current.filter((item) => item.id !== saved.id)];
          return next.slice(0, 30);
        });
      })
      .catch(() => {
        /* Persistence failure should not block the live turn. */
      });
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
        Assistant needs a Gemini API key on the server (`GEMINI_API_KEY`). Set it and reload.
      </div>
    );
  }
  if (!thread) return null;

  const scrollToLatest = () => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    setAtBottom(true);
  };

  const updateThread = (next: ChatThread | ((current: ChatThread) => ChatThread)) => {
    setThread((current) => {
      if (!current) return current;
      return typeof next === "function" ? next(current) : next;
    });
  };

  const insertAtCursor = (code: string) => {
    const view = views.get(documentId);
    if (!view || !view.state.facet(EditorView.editable)) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: code },
      annotations: [Transaction.userEvent.of("input.agent-insert"), isolateHistory.of("full")],
    });
    view.focus();
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
    const applied = applyReviewedProposal(proposal, views, canEdit);
    if (!applied) {
      markProposal(messageId, "stale");
      setError("The editor changed. Reject this proposal or ask again.");
      return;
    }
    onStopPlayback();
    markProposal(messageId, "applied");
    views.get(documentId)?.focus();
  };

  const send = async (text: string, regenerate = false) => {
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
    };
    // Failed turns leave empty assistant stubs; strip them so the next request validates.
    let history = thread.messages.filter(
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
    history = trimChatMessages(history);
    updateThread({
      ...thread,
      title: thread.messages.length ? thread.title : content.slice(0, 48),
      messages: [...history, assistantMessage],
    });
    setDraft("");
    setError(null);
    setPending(true);
    setStatus("Starting…");
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      scrollToLatest();
    });

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const attachedDocumentIds = [
        ...(includeActive ? [documentId] : []),
        ...attachedIds.filter((id) => id !== documentId),
      ];
      const fileIds =
        scope === "workspace"
          ? documents.map((file) => file.id)
          : attachedDocumentIds.length
            ? attachedDocumentIds
            : [documentId];
      const files = fileIds
        .map((id) => {
          const meta = documents.find((file) => file.id === id);
          const source = sources.find((file) => file.id === id)?.source;
          if (!meta || source === undefined) return null;
          return { id, name: meta.name, source };
        })
        .filter((file): file is { id: string; name: string; source: string } => !!file)
        .slice(0, 8);
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        signal: controller.signal,
        body: JSON.stringify({
          threadId: thread.id,
          documentId,
          mode,
          scope,
          messages: history
            .filter((message) => message.content.trim().length > 0)
            .map(({ role, content: body }) => ({ role, content: body })),
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
          if (atBottom) requestAnimationFrame(scrollToLatest);
        }
        if (event.type === "proposal") {
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

  return (
    <div className="jam-chat-panel">
      <div className="jam-chat-toolbar">
        <button
          type="button"
          className="jam-chat-tool-link"
          onClick={() => {
            abortRef.current?.abort();
            setThread(newChatThread(workspaceId));
            setError(null);
          }}
        >
          New
        </button>
        <label className="jam-chat-history">
          <span className="sr-only">Chat history</span>
          <select
            value={thread.id}
            aria-label="Chat history"
            onChange={(event) => {
              const next = threads.find((item) => item.id === event.target.value);
              if (next) setThread(next);
            }}
          >
            {!threads.some((item) => item.id === thread.id) && (
              <option value={thread.id}>{thread.title}</option>
            )}
            {threads.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="jam-chat-tool-link is-danger"
          disabled={!threads.some((item) => item.id === thread.id)}
          onClick={() => {
            const id = thread.id;
            void deleteChatThread(id).then(() => {
              setThreads((current) => current.filter((item) => item.id !== id));
              setThread(newChatThread(workspaceId));
            });
          }}
        >
          Delete
        </button>
      </div>

      <div
        ref={logRef}
        className="jam-chat-log"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(event) => {
          const node = event.currentTarget;
          setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 48);
        }}
      >
        {thread.messages.length === 0 ? (
          <div className="jam-chat-empty">
            <p className="jam-chat-empty-lead">
              {mode === "edit"
                ? "Describe a change. The assistant proposes a diff for you to review before it touches the code."
                : "Ask about this Strudel file, or switch to Edit for a reviewed change."}
            </p>
            <ul>
              {(mode === "ask"
                ? STARTER_PROMPTS
                : sources.find((file) => file.id === documentId)?.source.trim()
                  ? EDIT_STARTER_PROMPTS
                  : NEW_SONG_PROMPTS
              ).map((prompt) => (
                <li key={prompt}>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(prompt);
                      composerRef.current?.focus();
                    }}
                  >
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          thread.messages.map((message) => (
            <article
              key={message.id}
              className={`jam-chat-message is-${message.role}`}
              data-role={message.role}
            >
              <header>
                <span className="jam-chat-role">
                  {message.role === "user" ? "You" : "Assistant"}
                </span>
              </header>
              {message.content ? (
                <ChatMarkdown text={message.content} onInsertCode={insertAtCursor} />
              ) : pending && message.id === lastAssistant?.id ? (
                <p className="jam-chat-streaming" aria-hidden={!pending}>
                  {status ?? "Thinking…"}
                </p>
              ) : null}
              {message.proposal && (
                <ProposalCard
                  proposal={message.proposal.proposal}
                  status={
                    message.proposal.status === "pending" &&
                    !message.proposal.proposal.files.every((file) =>
                      sources.some(
                        (source) =>
                          source.id === file.documentId && source.source === file.baseSource,
                      ),
                    )
                      ? "stale"
                      : message.proposal.status
                  }
                  sources={sources}
                  onApplyAll={() => applyProposal(message.id, message.proposal!.proposal)}
                  onApplyFile={(id) => {
                    const file = message.proposal!.proposal.files.find(
                      (item) => item.documentId === id,
                    );
                    if (!file) return;
                    applyProposal(message.id, {
                      summary: message.proposal!.proposal.summary,
                      files: [file],
                    });
                  }}
                  onReject={() => markProposal(message.id, "rejected")}
                  onReveal={onReveal}
                />
              )}
              {message.seenDocumentIds?.length ? (
                <p className="jam-chat-seen" id={`${seenLabelId}-${message.id}`}>
                  Saw{" "}
                  {message.seenDocumentIds
                    .map((id) => documents.find((file) => file.id === id)?.name ?? id)
                    .join(", ")}
                </p>
              ) : null}
              {message.error && (
                <p role="alert" className="jam-chat-error">
                  <span>{message.error}</span>{" "}
                  <button type="button" onClick={() => void send(lastUserRef.current, true)}>
                    Retry
                  </button>
                </p>
              )}
            </article>
          ))
        )}
      </div>

      {!atBottom && (
        <button type="button" className="jam-chat-jump" onClick={scrollToLatest}>
          Latest
        </button>
      )}

      <div className="jam-chat-dock">
        <div className="jam-chat-dock-meta">
          <div className="jam-chat-context" aria-label="Assistant context">
            {includeActive && (
              <button
                type="button"
                className="jam-chat-chip"
                onClick={() => setIncludeActive(false)}
              >
                <span className="jam-chat-chip-label">{documentName}</span>
                <span className="jam-chat-chip-x" aria-hidden="true">
                  ×
                </span>
              </button>
            )}
            {includeSelection && selection && (
              <button
                type="button"
                className="jam-chat-chip is-selection"
                onClick={() => setIncludeSelection(false)}
              >
                <span className="jam-chat-chip-label">Selection</span>
                <span className="jam-chat-chip-x" aria-hidden="true">
                  ×
                </span>
              </button>
            )}
            {attachedIds.map((id) => {
              const file = documents.find((item) => item.id === id);
              if (!file || id === documentId) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="jam-chat-chip"
                  onClick={() => setAttachedIds((current) => current.filter((item) => item !== id))}
                >
                  <span className="jam-chat-chip-label">{file.name}</span>
                  <span className="jam-chat-chip-x" aria-hidden="true">
                    ×
                  </span>
                </button>
              );
            })}
            <div className="jam-chat-add-file">
              <button
                type="button"
                className="jam-chat-add-file-btn"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((open) => !open)}
              >
                + File
              </button>
              {pickerOpen && (
                <ul role="listbox" aria-label="Workspace files">
                  {documents
                    .filter((file) => file.id !== documentId && !attachedIds.includes(file.id))
                    .map((file) => (
                      <li key={file.id}>
                        <button
                          type="button"
                          role="option"
                          onClick={() => {
                            setAttachedIds((current) => [...current, file.id]);
                            setPickerOpen(false);
                          }}
                        >
                          {file.name}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          <div className="jam-chat-mode" role="group" aria-label="Assistant mode">
            <button
              type="button"
              className={mode === "ask" ? "is-active" : undefined}
              aria-pressed={mode === "ask"}
              onClick={() => setMode("ask")}
            >
              Ask
            </button>
            <button
              type="button"
              className={mode === "edit" ? "is-active" : undefined}
              aria-pressed={mode === "edit"}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
            {mode === "edit" && (
              <select
                aria-label="Edit scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as ChatScope)}
              >
                <option value="active">Active file</option>
                <option value="workspace">Workspace</option>
              </select>
            )}
          </div>
        </div>

        <div className="jam-chat-composer">
          <textarea
            ref={composerRef}
            aria-label="Message the assistant"
            rows={2}
            value={draft}
            placeholder="Ask about this file… (/explain, /fix, /clear)"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && pending) {
                event.preventDefault();
                abortRef.current?.abort();
                return;
              }
              if (event.key === "ArrowUp" && !draft && lastUserRef.current) {
                event.preventDefault();
                setDraft(lastUserRef.current);
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!pending) void send(draft);
              }
            }}
          />
          {pending ? (
            <Button
              size="sm"
              variant="outline"
              type="button"
              className="jam-chat-send"
              onClick={() => abortRef.current?.abort()}
            >
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              type="button"
              className="jam-chat-send"
              disabled={!draft.trim() && !draft.startsWith("/")}
              onClick={() => void send(draft)}
            >
              Send
            </Button>
          )}
        </div>
        <div className="jam-chat-footer-row">
          {lastAssistant && !pending && lastAssistant.content && (
            <button
              type="button"
              className="jam-chat-tool-link jam-chat-regenerate"
              onClick={() => void send(lastUserRef.current, true)}
            >
              Regenerate
            </button>
          )}
          {pending && status && (
            <p className="jam-chat-streaming" role="status">
              {status}
            </p>
          )}
        </div>
        {bannerError && (
          <p role="alert" className="jam-chat-error jam-chat-error-banner">
            <span>{bannerError}</span>
          </p>
        )}
      </div>
    </div>
  );
}
