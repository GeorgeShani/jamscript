import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DocumentRecord, WorkspaceStorage } from "@/workspaces/storage";

type GitService = NonNullable<WorkspaceStorage["git"]>;
type GitState = Awaited<ReturnType<GitService["status"]>>;

/** Local Git is an explicit desktop capability, independent of workspace identity. */
export function GitPanel({
  workspaceId,
  documents,
  git,
  isDirty,
  onFilesChanged,
}: {
  workspaceId: string;
  documents: DocumentRecord[];
  git: GitService;
  isDirty: (document: DocumentRecord) => boolean;
  onFilesChanged?: () => void;
}) {
  const [status, setStatus] = useState<GitState | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cloneUrl, setCloneUrl] = useState("");
  useEffect(() => {
    let current = true;
    setStatus(null);
    setMissing(false);
    void git
      .status(workspaceId)
      .then((value) => {
        if (current) setStatus(value);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        const text = cause instanceof Error ? cause.message : String(cause);
        if (text.includes("No Git repository")) setMissing(true);
        else setError(text);
      });
    return () => {
      current = false;
    };
  }, [workspaceId, git]);

  const run = async (action: () => Promise<GitState>, filesChanged = false) => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await action());
      setMissing(false);
      setSelected([]);
      setMessage("");
      if (filesChanged) onFilesChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const eligible =
    status?.files.filter(
      (file) =>
        file.status === "deleted" || documents.some((document) => document.name === file.name),
    ) ?? [];
  return (
    <details className="jam-git-control">
      <summary>Git</summary>
      <div className="jam-git-popup">
        {missing ? (
          <>
            <p>This folder has no Git repository.</p>
            <Button
              size="sm"
              type="button"
              disabled={busy}
              onClick={() => void run(() => git.initialize(workspaceId))}
            >
              Initialize Git
            </Button>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => git.cloneInto(workspaceId, cloneUrl), true);
              }}
            >
              <label>
                Clone HTTPS repository into this empty folder
                <input
                  type="url"
                  value={cloneUrl}
                  placeholder="https://github.com/owner/repository.git"
                  onChange={(event) => setCloneUrl(event.target.value)}
                  required
                />
              </label>
              <Button
                size="sm"
                type="submit"
                disabled={busy || !cloneUrl.startsWith("https://") || documents.length > 0}
              >
                Clone into folder
              </Button>
              {documents.length > 0 && <p>Choose an empty folder to clone a repository.</p>}
            </form>
          </>
        ) : status ? (
          <>
            <p>
              {status.branch ?? "New repository"} · {status.files.length} changed music files
            </p>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => void run(() => git.status(workspaceId))}
            >
              Refresh status
            </Button>
            <div className="jam-git-sync-actions">
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => void run(() => git.push(workspaceId))}
              >
                Push commits
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={busy || documents.some(isDirty)}
                onClick={() => void run(() => git.pull(workspaceId, documents), true)}
              >
                Pull fast-forward
              </Button>
            </div>
            <p>
              Sync requires an origin remote and Git credentials. Pull refuses local changes and
              divergent history.
            </p>
            {eligible.length > 0 && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const files = documents.filter(
                    (document) =>
                      selected.includes(document.name) &&
                      eligible.some(
                        (file) => file.name === document.name && file.status !== "deleted",
                      ),
                  );
                  const deleted = eligible
                    .filter((file) => file.status === "deleted" && selected.includes(file.name))
                    .map((file) => file.name);
                  void run(() => git.commit(workspaceId, files, deleted, message));
                }}
              >
                <fieldset>
                  <legend>Saved music files to commit</legend>
                  {eligible.map((file) => {
                    const document = documents.find((item) => item.name === file.name);
                    const dirty = document ? isDirty(document) : false;
                    return (
                      <label key={file.name}>
                        <input
                          type="checkbox"
                          disabled={dirty || busy}
                          checked={selected.includes(file.name)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, file.name]
                                : current.filter((name) => name !== file.name),
                            )
                          }
                        />
                        {file.name} · {dirty ? "Save first" : file.status}
                      </label>
                    );
                  })}
                </fieldset>
                <label>
                  Commit message
                  <input
                    value={message}
                    maxLength={500}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </label>
                <Button
                  size="sm"
                  type="submit"
                  disabled={busy || !selected.length || !message.trim()}
                >
                  Commit selected files
                </Button>
              </form>
            )}
          </>
        ) : (
          <p>Loading repository status…</p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
