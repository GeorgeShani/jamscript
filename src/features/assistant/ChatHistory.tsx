import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  History,
  MoreHorizontal,
  Pencil,
  Search,
  SquarePen,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { downloadChat, chatMarkdown } from "./chat-actions";
import type { ChatThread } from "./chat-types";

export function ChatHistory({
  thread,
  threads,
  pending,
  onNew,
  onSelect,
  onRename,
  onDelete,
  onError,
}: {
  thread: ChatThread;
  threads: ChatThread[];
  pending: boolean;
  onNew: () => void;
  onSelect: (thread: ChatThread) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState<"rename" | "delete" | null>(null);
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const query = search.trim().toLocaleLowerCase();
  const matches = threads.filter(
    (item) =>
      item.messages.length &&
      (!query ||
        item.title.toLocaleLowerCase().includes(query) ||
        item.messages.some((message) => message.content.toLocaleLowerCase().includes(query))),
  );
  return (
    <header className="jam-assistant-header">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="jam-assistant-history-trigger"
            aria-label="Chat history"
            title="Search chats"
            disabled={pending}
          >
            <History /> <span>History</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="jam-assistant-history">
          <div className="jam-assistant-history-search">
            <Search size={15} aria-hidden="true" />
            <Input
              aria-label="Search chats"
              placeholder="Search chats…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="jam-assistant-history-list" aria-label="Saved chats">
            {matches.length ? (
              matches.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className="jam-assistant-history-row"
                  aria-current={item.id === thread.id ? "true" : undefined}
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {[...item.messages]
                        .reverse()
                        .find((message) => message.content.trim())
                        ?.content.slice(0, 88)}
                    </small>
                  </span>
                  {item.id === thread.id && <Check size={14} />}
                </Button>
              ))
            ) : (
              <p className="jam-assistant-menu-note">
                {query ? "No matching chats." : "Your conversations will appear here."}
              </p>
            )}
          </div>
          <p className="jam-assistant-menu-note">
            Saved on this device · up to 30 chats per workspace
          </p>
        </PopoverContent>
      </Popover>
      <div className="jam-assistant-heading">
        <strong>{thread.messages.length ? thread.title : "JamScript"}</strong>
        <span>
          {thread.messages.length ? "Workspace conversation" : "Your music, a conversation away"}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="jam-assistant-new-chat"
        aria-label="New chat"
        title="New chat"
        onClick={onNew}
        disabled={pending}
      >
        <SquarePen /> <span>New chat</span>
      </Button>
      <Popover
        open={menuOpen}
        onOpenChange={(value) => {
          setMenuOpen(value);
          setAction(null);
          setCopied(false);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Conversation actions"
            disabled={pending || !thread.messages.length}
          >
            <MoreHorizontal />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="jam-assistant-thread-menu">
          {action === "rename" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (title.trim()) {
                  onRename(title.trim());
                  setMenuOpen(false);
                }
              }}
            >
              <label htmlFor="chat-rename">Rename conversation</label>
              <Input
                id="chat-rename"
                aria-label="Conversation title"
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <div className="jam-assistant-inline-actions">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!title.trim()}>
                  Save name
                </Button>
              </div>
            </form>
          ) : action === "delete" ? (
            <div>
              <strong>Delete this conversation?</strong>
              <p className="jam-assistant-menu-note">
                This removes its messages from this device. Your music files stay as they are.
              </p>
              <div className="jam-assistant-inline-actions">
                <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                >
                  Delete conversation
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                className="jam-assistant-menu-action"
                onClick={() => {
                  setTitle(thread.title);
                  setAction("rename");
                }}
              >
                <Pencil /> Rename
              </Button>
              <Button
                variant="ghost"
                className="jam-assistant-menu-action"
                onClick={() => {
                  downloadChat(thread);
                  setMenuOpen(false);
                }}
              >
                <Download /> Export as Markdown
              </Button>
              <Button
                variant="ghost"
                className="jam-assistant-menu-action"
                onClick={() => {
                  void Promise.resolve()
                    .then(() => navigator.clipboard.writeText(chatMarkdown(thread)))
                    .then(() => setCopied(true))
                    .catch(() =>
                      onError("Could not copy this conversation. Try exporting it instead."),
                    );
                }}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy conversation"}
              </Button>
              <div className="jam-assistant-menu-divider" />
              <Button
                variant="ghost"
                className="jam-assistant-menu-action text-destructive"
                onClick={() => setAction("delete")}
              >
                <Trash2 /> Delete conversation
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </header>
  );
}
