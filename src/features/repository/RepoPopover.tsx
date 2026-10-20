// Presentation-only Repo preview. Real Git and safe document loading belong outside this UI batch.
import { useId, useRef, useState } from "react";
import {
  CloudDownload,
  CloudUpload,
  FileText,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  REPO_EXPLANATIONS,
  REPO_FILES,
  REPO_FIXTURES,
  REPO_OPEN_FILE,
  REPO_SUMMARY,
  addPreviewChanges,
  canPreviewCommit,
  commitPreview,
  repoPrimaryAction,
  type RepoPreview,
} from "./repo-fixtures";

export function RepoPopover({
  onOpenDiff,
  open: controlledOpen,
  onOpenChange,
  suppressCloseFocus = false,
  fixture = REPO_FIXTURES.changed,
}: {
  onOpenDiff: (launcher: HTMLElement | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  suppressCloseFocus?: boolean;
  fixture?: RepoPreview;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const reviewPending = useRef(false);
  const id = useId();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (next: boolean) => {
    setLocalOpen(next);
    onOpenChange?.(next);
  };
  const [preview, setPreview] = useState(fixture);
  const [selected, setSelected] = useState<string>(REPO_OPEN_FILE);
  const [message, setMessage] = useState(REPO_SUMMARY);
  const [address, setAddress] = useState("https://github.com/example/night-bus-songs");
  const [notice, setNotice] = useState("");
  const primary = repoPrimaryAction(preview);
  const busy = preview.status === "busy";
  const canCommit = canPreviewCommit(preview, message);
  const commit = () => {
    if (!canCommit) return;
    setPreview((current) => commitPreview(current, message));
    setNotice("Preview commit created. Code and the current Take are unchanged.");
    toast("Preview commit created");
  };
  const openReview = () => {
    reviewPending.current = true;
    setOpen(false);
  };
  const loadHelp =
    preview.status === "unsavedEditor"
      ? REPO_EXPLANATIONS.unsavedEditor
      : "Loading another file is not connected yet. Selecting an example does not change the open song.";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={trigger}
          variant="outline"
          size="sm"
          className="min-w-0 max-w-full gap-1 px-2 min-[600px]:gap-2 min-[600px]:px-3"
          aria-expanded={open}
          aria-label={preview.exists ? `main${preview.changed ? " 1 change" : ""}` : "Repo"}
        >
          <GitBranch />
          {preview.exists ? <span className="code-face max-w-[12ch] truncate">main</span> : "Repo"}
          {preview.changed && (
            <span className="shrink-0">
              1<span className="hidden min-[600px]:inline"> change</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-review-transient
        aria-labelledby={`${id}-title`}
        align="start"
        collisionPadding={8}
        className="jam-repo-popover w-90 overflow-y-auto overflow-x-hidden overscroll-contain"
        onCloseAutoFocus={(event) => {
          if (suppressCloseFocus) {
            event.preventDefault();
            return;
          }
          if (!reviewPending.current) return;
          event.preventDefault();
          reviewPending.current = false;
          requestAnimationFrame(() => onOpenDiff(trigger.current));
        }}
      >
        <div className="divide-y divide-border *:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
          <div className="space-y-1">
            <h2 id={`${id}-title`} className="text-label font-medium">
              Repo preview
            </h2>
            <p className="text-ui text-muted-foreground">
              These examples do not read or publish a repository.
            </p>
            {preview.exists && (
              <div className="pt-2">
                <div className="code-face truncate">example/night-bus-songs</div>
                <div className="code-face flex items-center gap-1 text-muted-foreground">
                  <GitBranch className="size-3.5" aria-hidden />
                  main
                </div>
              </div>
            )}
          </div>
          {REPO_EXPLANATIONS[preview.status] && (
            <p className="text-ui text-muted-foreground">{REPO_EXPLANATIONS[preview.status]}</p>
          )}
          {notice && (
            <p role="status" className="text-ui text-muted-foreground">
              {notice}
            </p>
          )}
          {!preview.exists ? (
            <div className="space-y-2">
              <h3 className="text-label font-medium">Clone a repo</h3>
              <Input
                aria-label="Example repo address"
                aria-describedby={`${id}-title`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="code-face"
              />
              <Button
                size="sm"
                disabled={!address.trim()}
                onClick={() => {
                  setPreview(REPO_FIXTURES.changed);
                  setNotice("Example repo opened. No repository was read.");
                }}
              >
                <FolderGit2 />
                Clone
              </Button>
            </div>
          ) : (
            <>
              <Section title="Files">
                <ul>
                  {REPO_FILES.map((file) => (
                    <li key={file}>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSelected(file)}
                        aria-pressed={selected === file}
                        aria-current={file === REPO_OPEN_FILE ? "page" : undefined}
                        className={cn(
                          "h-8 w-full justify-start px-2 text-left",
                          selected === file && "bg-selection",
                        )}
                      >
                        <FileText className="text-muted-foreground" aria-hidden />
                        <span className="code-face min-w-0 flex-1 truncate">{file}</span>
                        {file === REPO_OPEN_FILE && (
                          <span className="text-label text-muted-foreground">Open</span>
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" disabled aria-describedby={`${id}-load`}>
                  Open selected file
                </Button>
                <p id={`${id}-load`} className="text-ui text-muted-foreground">
                  {loadHelp}
                </p>
              </Section>
              {preview.changed && (
                <Section
                  title={preview.added ? "Ready to commit" : "Changes"}
                  action={
                    !preview.added && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setPreview((state) => addPreviewChanges(state, true))}
                      >
                        Add all
                      </Button>
                    )
                  }
                >
                  <ChangeRow
                    onOpen={openReview}
                    actionLabel={preview.added ? "Remove" : "Add"}
                    disabled={busy}
                    onAction={() => setPreview((state) => addPreviewChanges(state, !state.added))}
                  />
                </Section>
              )}
              {preview.changed && (
                <div className="space-y-2">
                  <Textarea
                    rows={2}
                    aria-label="Commit message"
                    value={message}
                    disabled={busy}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-invalid={!message.trim()}
                    aria-describedby={`${id}-commit${!message.trim() ? ` ${id}-message-error` : ""}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        commit();
                      }
                    }}
                    className="max-h-[calc(4*1.55em+12px)] resize-none"
                  />
                  <p id={`${id}-commit`} className="text-ui text-muted-foreground">
                    {preview.added
                      ? "Commit includes the added example changes only."
                      : "When none are added, Commit includes all example changes."}{" "}
                    Code and the current Take are unchanged.
                  </p>
                  {!message.trim() && (
                    <p
                      id={`${id}-message-error`}
                      role="status"
                      className="text-ui text-destructive"
                    >
                      Write a message before creating a preview commit.
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant={primary === "commit" ? "default" : "outline"}
                    disabled={!canCommit}
                    onClick={commit}
                  >
                    <GitCommitHorizontal />
                    Commit
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={primary === "push" ? "default" : "outline"}
                    disabled
                    aria-describedby={`${id}-publish`}
                  >
                    <CloudUpload />
                    Push to main
                  </Button>
                  <Button size="sm" variant="outline" disabled aria-describedby={`${id}-pull`}>
                    <CloudDownload />
                    Pull
                  </Button>
                  {preview.ahead > 0 && (
                    <span className="text-ui text-muted-foreground">
                      <span className="code-face">{preview.ahead}</span> to push
                    </span>
                  )}
                  {preview.behind > 0 && (
                    <span className="text-ui text-muted-foreground">
                      <span className="code-face">{preview.behind}</span> to pull
                    </span>
                  )}
                </div>
                <p id={`${id}-publish`} className="text-ui text-muted-foreground">
                  GitHub publishing is not connected yet.
                </p>
                <p id={`${id}-pull`} className="text-ui text-muted-foreground">
                  Pulling is not connected yet.
                </p>
              </div>
              {preview.history.length > 0 && (
                <Section title="History" icon={<History className="size-3.5" aria-hidden />}>
                  <ul className="space-y-2 px-2">
                    {preview.history.slice(0, 5).map((entry) => (
                      <li key={entry.id}>
                        <div className="truncate text-ui" title={entry.message}>
                          {entry.message}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-ui text-muted-foreground">
                          <span className="code-face">{entry.id}</span>
                          <span>{entry.when}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      <div className="flex h-7 items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-label font-medium text-muted-foreground">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function ChangeRow({
  onOpen,
  actionLabel,
  onAction,
  disabled,
}: {
  onOpen: () => void;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start gap-1 rounded-md jam-transition hover:bg-muted">
      <Button
        variant="ghost"
        onClick={onOpen}
        className="h-auto min-w-0 flex-1 flex-col items-stretch gap-0 whitespace-normal px-2 py-1.5 text-left"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <FileText className="text-muted-foreground" aria-hidden />
          <span className="code-face">night-bus.js</span>
          <span className="text-label">Changed</span>
          <span className="code-face">
            <span className="text-success">+2</span> <span className="text-destructive">-2</span>
          </span>
        </span>
        <span className="pl-6 text-ui text-muted-foreground">{REPO_SUMMARY}</span>
      </Button>
      <Button variant="ghost" size="sm" disabled={disabled} className="mt-1" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
