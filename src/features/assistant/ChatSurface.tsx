import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  FileCode2,
  FilePenLine,
  GitBranch,
  MessageSquare,
  Paperclip,
  Pencil,
  RotateCcw,
  Search,
  Square,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import { ChatHistory } from "./ChatHistory";
import { ChatMarkdown } from "./chat-markdown";
import { modelName } from "./chat-actions";
import { STARTER_PROMPTS, EDIT_STARTER_PROMPTS, NEW_SONG_PROMPTS } from "./chat-slash";
import {
  CHAT_LIMITS,
  type ChatMessage,
  type ChatMode,
  type ChatScope,
  type ChatThread,
} from "./chat-types";
import { shareableDocumentName } from "../collaboration/shareable";
import "./chat-surface.css";

function Action({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ChatSurface(props: {
  thread: ChatThread;
  threads: ChatThread[];
  pending: boolean;
  status: string | null;
  error: string | null;
  draft: string;
  onDraft: (value: string) => void;
  mode: ChatMode;
  onMode: (mode: ChatMode) => void;
  scope: ChatScope;
  onScope: (scope: ChatScope) => void;
  canEdit: boolean;
  documentId: string;
  documentName: string;
  documents: { id: string; name: string }[];
  attachedIds: string[];
  onAttach: (id: string) => void;
  onDetach: (id: string) => void;
  selection: string;
  includeSelection: boolean;
  onSelection: (include: boolean) => void;
  hasSource: boolean;
  models: { ask: string[]; edit: string[] };
  model: string;
  onModel: (model: string) => void;
  onNew: () => void;
  onSelect: (thread: ChatThread) => void;
  onRename: (title: string) => void;
  onDelete: (threadId?: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage, text: string) => void;
  onBranch: (message: ChatMessage) => void;
  onError: (message: string) => void;
  renderProposal: (message: ChatMessage) => ReactNode;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { thread, pending, mode } = props;
  const [editing, setEditing] = useState<string | null>(null);
  const [edited, setEdited] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [fileSearch, setFileSearch] = useState("");
  const [modelsOpen, setModelsOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const previousThread = useRef(thread.id);
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(null), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copied]);
  useEffect(() => {
    if (previousThread.current !== thread.id) {
      setEditing(null);
      previousThread.current = thread.id;
    }
  }, [thread.id]);
  const lastAssistant = [...thread.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const lastUser = [...thread.messages].reverse().find((message) => message.role === "user");
  const copy = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
    } catch {
      props.onError("Could not copy this message. Check clipboard permissions.");
    }
  };
  const choices = props.models[mode];
  const availableFiles = props.documents.filter(
    (file) =>
      shareableDocumentName(file.name) &&
      file.id !== props.documentId &&
      !props.attachedIds.includes(file.id) &&
      file.name.toLowerCase().includes(fileSearch.toLowerCase()),
  );
  const suggestions =
    mode === "ask" ? STARTER_PROMPTS : props.hasSource ? EDIT_STARTER_PROMPTS : NEW_SONG_PROMPTS;
  return (
    <TooltipProvider delayDuration={300}>
      <div className="jam-chat-panel jam-assistant">
        <ChatHistory {...props} />
        <MessageScrollerProvider
          key={thread.id}
          autoScroll={thread.messages.length > 0}
          defaultScrollPosition={thread.messages.length ? "last-anchor" : "start"}
        >
          <MessageScroller className="jam-assistant-conversation">
            <MessageScrollerViewport
              className="jam-assistant-viewport"
              role="log"
              aria-label="Conversation"
              aria-live="polite"
              aria-relevant="additions"
            >
              <MessageScrollerContent className="jam-assistant-transcript">
                {!thread.messages.length ? (
                  <div className="jam-assistant-welcome">
                    <img src="/brand/logo.svg" alt="JamScript" width={130} height={26} />
                    <h2>
                      {mode === "edit" ? "What should we change?" : "What are we playing today?"}
                    </h2>
                    <p>
                      {mode === "edit"
                        ? "Describe your idea. Review every change before it reaches your music."
                        : "Explore a groove, untangle a pattern, or find your next idea."}
                    </p>
                    <div className="jam-assistant-suggestions">
                      {suggestions.map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          onClick={() => {
                            props.onDraft(suggestion);
                            props.composerRef.current?.focus();
                          }}
                        >
                          <span>{suggestion}</span>
                          <ArrowUp size={14} aria-hidden="true" />
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  thread.messages.map((message) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <Message
                        align={message.role === "user" ? "end" : "start"}
                        className={`jam-assistant-message is-${message.role}`}
                        data-role={message.role}
                      >
                        <MessageContent>
                          {message.role === "assistant" && (
                            <div className="jam-assistant-author">
                              <img
                                src="/brand/mark.svg"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                                alt=""
                                width={18}
                                height={18}
                              />
                              <span>JamScript</span>
                              {pending && message.id === lastAssistant?.id && (
                                <span className="jam-assistant-generating" aria-hidden="true">
                                  <i />
                                  <i />
                                  <i />
                                </span>
                              )}
                            </div>
                          )}
                          {editing === message.id ? (
                            <form
                              className="jam-assistant-edit-message"
                              onSubmit={(event) => {
                                event.preventDefault();
                                if (edited.trim()) {
                                  props.onEdit(message, edited.trim());
                                  setEditing(null);
                                }
                              }}
                            >
                              <Textarea
                                aria-label="Edit your message"
                                value={edited}
                                maxLength={CHAT_LIMITS.maxMessageChars}
                                onChange={(event) => setEdited(event.target.value)}
                                autoFocus
                              />
                              <p>Sending creates a new branch and keeps this conversation.</p>
                              <div className="jam-assistant-inline-actions">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditing(null)}
                                >
                                  Cancel
                                </Button>
                                <Button size="sm" type="submit" disabled={!edited.trim()}>
                                  Save &amp; send
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <Bubble
                              variant={message.role === "user" ? "muted" : "ghost"}
                              align={message.role === "user" ? "end" : "start"}
                              className="jam-assistant-bubble"
                            >
                              <BubbleContent>
                                {message.content ? (
                                  message.role === "user" ? (
                                    <p className="jam-assistant-user-text">{message.content}</p>
                                  ) : (
                                    <ChatMarkdown text={message.content} />
                                  )
                                ) : pending && message.id === lastAssistant?.id ? (
                                  <p className="jam-assistant-thinking">
                                    {props.status ?? "Thinking…"}
                                  </p>
                                ) : null}
                              </BubbleContent>
                            </Bubble>
                          )}
                          {props.renderProposal(message)}
                          {message.seenDocumentIds?.length ? (
                            <details className="jam-assistant-sources">
                              <summary>
                                Read {message.seenDocumentIds.length}{" "}
                                {message.seenDocumentIds.length === 1 ? "file" : "files"}
                              </summary>
                              <ul>
                                {message.seenDocumentIds.map((id) => (
                                  <li key={id}>
                                    <FileCode2 size={13} />
                                    {props.documents.find((file) => file.id === id)?.name ?? id}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                          {message.error && (
                            <div className="jam-assistant-message-error" role="alert">
                              <p>{message.error}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => props.onRetry(message)}
                              >
                                <RotateCcw size={13} />
                                Retry
                              </Button>
                            </div>
                          )}
                          {!!message.content && editing !== message.id && (
                            <MessageFooter className="jam-assistant-message-actions">
                              <Action
                                label={copied === message.id ? "Copied message" : "Copy message"}
                                onClick={() => void copy(message)}
                              >
                                {copied === message.id ? <Check /> : <Copy />}
                              </Action>
                              {message.role === "user" ? (
                                <Action
                                  label="Edit message"
                                  disabled={pending}
                                  onClick={() => {
                                    setEditing(message.id);
                                    setEdited(message.content);
                                  }}
                                >
                                  <Pencil />
                                </Action>
                              ) : (
                                <>
                                  <Action
                                    label="Regenerate response"
                                    disabled={pending}
                                    onClick={() => props.onRetry(message)}
                                  >
                                    <RotateCcw />
                                  </Action>
                                  <Action
                                    label="Branch conversation"
                                    disabled={pending}
                                    onClick={() => props.onBranch(message)}
                                  >
                                    <GitBranch />
                                  </Action>
                                </>
                              )}
                            </MessageFooter>
                          )}
                          {message.id === lastAssistant?.id &&
                            message.role === "assistant" &&
                            message.content &&
                            !message.error &&
                            !message.proposal &&
                            !pending &&
                            mode === "ask" &&
                            props.canEdit &&
                            lastUser && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="jam-assistant-propose"
                                onClick={() => {
                                  props.onMode("edit");
                                  props.onDraft(lastUser.content);
                                  props.composerRef.current?.focus();
                                }}
                              >
                                <FilePenLine size={13} />
                                Propose an edit for this request
                              </Button>
                            )}
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ))
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton
              aria-label="Jump to latest message"
              className="jam-assistant-jump"
            />
          </MessageScroller>
        </MessageScrollerProvider>
        <div className="jam-assistant-dock">
          <div className="jam-assistant-context" aria-label="Assistant context">
            <span className="jam-assistant-file" title="Active file is included">
              <FileCode2 size={13} />
              <span>{props.documentName}</span>
            </span>
            {props.includeSelection && props.selection && (
              <Button
                variant="ghost"
                size="sm"
                className="jam-assistant-file"
                aria-label="Remove selection from context"
                onClick={() => props.onSelection(false)}
              >
                Selection
                <X size={12} />
              </Button>
            )}
            {props.attachedIds
              .filter((id) => id !== props.documentId)
              .map((id) => (
                <Button
                  key={id}
                  variant="ghost"
                  size="sm"
                  className="jam-assistant-file"
                  aria-label={`Remove ${props.documents.find((file) => file.id === id)?.name ?? "file"} from context`}
                  onClick={() => props.onDetach(id)}
                >
                  <FileCode2 size={13} />
                  <span>
                    {props.documents.find((file) => file.id === id)?.name ?? "Missing file"}
                  </span>
                  <X size={12} />
                </Button>
              ))}
          </div>
          <InputGroup className="jam-assistant-composer">
            <InputGroupTextarea
              ref={props.composerRef}
              aria-label="Message the assistant"
              rows={2}
              maxLength={CHAT_LIMITS.maxMessageChars}
              value={props.draft}
              placeholder={
                mode === "edit" ? "Describe the change you want…" : "Ask about your music…"
              }
              onChange={(event) => props.onDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Escape" && pending) {
                  event.preventDefault();
                  props.onStop();
                }
                if (event.key === "ArrowUp" && !props.draft && lastUser) {
                  event.preventDefault();
                  props.onDraft(lastUser.content);
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!pending) props.onSend(props.draft);
                }
              }}
            />
            <InputGroupAddon align="block-end" className="jam-assistant-composer-tools">
              <Popover open={filesOpen} onOpenChange={setFilesOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Attach workspace files"
                    title="Add context"
                    disabled={pending}
                  >
                    <Paperclip />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="jam-assistant-file-picker">
                  <strong>Add workspace context</strong>
                  <Input
                    aria-label="Search workspace files"
                    placeholder="Find a file…"
                    value={fileSearch}
                    onChange={(event) => setFileSearch(event.target.value)}
                  />
                  {props.selection && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="jam-assistant-menu-action"
                      onClick={() => {
                        props.onSelection(!props.includeSelection);
                        setFilesOpen(false);
                      }}
                    >
                      {props.includeSelection && <Check size={13} />}Include selected code
                    </Button>
                  )}
                  <div role="listbox" aria-label="Workspace files">
                    {availableFiles.length ? (
                      availableFiles.map((file) => (
                        <Button
                          key={file.id}
                          variant="ghost"
                          className="jam-assistant-menu-action"
                          role="option"
                          aria-selected={false}
                          disabled={props.attachedIds.length >= CHAT_LIMITS.maxAttachedFiles - 1}
                          onClick={() => {
                            props.onAttach(file.id);
                            setFilesOpen(false);
                          }}
                        >
                          <FileCode2 />
                          {file.name}
                        </Button>
                      ))
                    ) : (
                      <p className="jam-assistant-menu-note">No more matching source files.</p>
                    )}
                  </div>
                  <p className="jam-assistant-menu-note">
                    Active file + up to 7 attachments. Files stay in your workspace.
                  </p>
                </PopoverContent>
              </Popover>
              <div className="jam-assistant-modes" role="group" aria-label="Assistant mode">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={mode === "ask"}
                  disabled={pending}
                  onClick={() => props.onMode("ask")}
                >
                  <MessageSquare size={13} />
                  Ask
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={mode === "edit"}
                  disabled={pending || !props.canEdit}
                  onClick={() => props.onMode("edit")}
                >
                  <FilePenLine size={13} />
                  Edit
                </Button>
              </div>
              <span className="jam-assistant-tool-spacer" />
              {pending ? (
                <Action
                  label="Stop generating"
                  className="jam-assistant-submit"
                  onClick={props.onStop}
                >
                  <Square fill="currentColor" size={14} />
                </Action>
              ) : mode === "ask" ? (
                <Action
                  label="Send"
                  className="jam-assistant-submit"
                  disabled={!props.draft.trim()}
                  onClick={() => props.onSend(props.draft)}
                >
                  <ArrowUp />
                </Action>
              ) : null}
            </InputGroupAddon>
            {mode === "edit" && !pending && (
              <InputGroupAddon align="block-end" className="jam-assistant-edit-submit">
                <Button
                  className="w-full"
                  disabled={!props.draft.trim() || !props.canEdit}
                  onClick={() => props.onSend(props.draft)}
                >
                  <ArrowUp size={14} />
                  Propose changes
                </Button>
              </InputGroupAddon>
            )}
          </InputGroup>
          <div className="jam-assistant-options">
            <Popover open={modelsOpen} onOpenChange={setModelsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Choose assistant model"
                  disabled={pending}
                >
                  <span>{props.model ? modelName(props.model) : "Auto"}</span>
                  <ChevronDown size={12} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="jam-assistant-models">
                <strong>Model for {mode === "ask" ? "Ask" : "Edit"}</strong>
                <div className="jam-assistant-history-search">
                  <Search size={14} />
                  <Input
                    aria-label="Search models"
                    placeholder="Find a model…"
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                  />
                </div>
                <div role="listbox" aria-label="Assistant models">
                  <Button
                    role="option"
                    aria-selected={!props.model}
                    variant="ghost"
                    className="jam-assistant-menu-action"
                    onClick={() => {
                      props.onModel("");
                      setModelsOpen(false);
                    }}
                  >
                    <span>
                      Auto<small>Use the configured fallback order</small>
                    </span>
                    {!props.model && <Check size={14} />}
                  </Button>
                  {choices
                    .filter((id) => id.toLowerCase().includes(modelSearch.toLowerCase()))
                    .map((id) => (
                      <Button
                        key={id}
                        role="option"
                        aria-selected={props.model === id}
                        variant="ghost"
                        className="jam-assistant-menu-action"
                        onClick={() => {
                          props.onModel(id);
                          setModelsOpen(false);
                        }}
                      >
                        <span>
                          {modelName(id)}
                          <small>{id.split("/")[0]}</small>
                        </span>
                        {props.model === id && <Check size={14} />}
                      </Button>
                    ))}
                </div>
                <p className="jam-assistant-menu-note">
                  Your choice runs first. Other configured models remain fallbacks.
                </p>
              </PopoverContent>
            </Popover>
            <select
              aria-label="Files in assistant context"
              value={props.scope}
              disabled={pending}
              onChange={(event) => props.onScope(event.target.value as ChatScope)}
            >
              <option value="active">This file</option>
              <option value="workspace">Workspace (up to 8 files)</option>
            </select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="jam-assistant-help-trigger"
                  aria-label="Assistant mode help"
                >
                  <Info size={13} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {!props.canEdit
                  ? "You can ask about this shared file. Editing requires editor access."
                  : mode === "edit"
                    ? "Review the diff before applying. Your code stays in your control."
                    : "Ask explains. Edit proposes changes for you to review."}
              </TooltipContent>
            </Tooltip>
          </div>
          {props.error && (
            <p className="jam-chat-error" role="alert">
              {props.error}
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
