import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DocumentRecord, WorkspaceStorage } from "@/workspaces/storage";

type GitService = NonNullable<WorkspaceStorage["git"]>;
type GitState = Awaited<ReturnType<GitService["status"]>>;
type AuthState = Awaited<ReturnType<GitService["githubAuthStatus"]>>;

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
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [deviceUri, setDeviceUri] = useState<string | null>(null);

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
    void git
      .githubAuthStatus()
      .then((value) => {
        if (current) setAuth(value);
      })
      .catch(() => {
        if (current) setAuth({ signedIn: false, deviceFlowAvailable: false });
      });
    return () => {
      current = false;
    };
  }, [workspaceId, git]);

  useEffect(() => {
    if (!deviceCode) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void git.pollGitHubDeviceFlow().then((result) => {
        if (cancelled) return;
        if (result.status === "complete") {
          setDeviceCode(null);
          setDeviceUri(null);
          void git.githubAuthStatus().then(setAuth);
        } else if (result.status === "denied" || result.status === "expired") {
          setDeviceCode(null);
          setDeviceUri(null);
          setError(
            result.status === "denied"
              ? "GitHub sign-in was denied."
              : "GitHub sign-in expired. Start again.",
          );
        }
      });
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deviceCode, git]);

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
        <section className="jam-git-auth" aria-label="GitHub credentials">
          <p>
            {auth?.signedIn
              ? "GitHub credentials are stored in this computer’s keychain."
              : "Sign in for private clone, push and pull. Local commit works without GitHub."}
          </p>
          {auth?.signedIn ? (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                void git
                  .signOutGitHub()
                  .then(setAuth)
                  .catch((cause: unknown) =>
                    setError(cause instanceof Error ? cause.message : String(cause)),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Sign out of GitHub
            </Button>
          ) : (
            <>
              {auth?.deviceFlowAvailable && (
                <Button
                  size="sm"
                  type="button"
                  disabled={busy || !!deviceCode}
                  onClick={() => {
                    setBusy(true);
                    setError(null);
                    void git
                      .beginGitHubDeviceFlow()
                      .then((begin) => {
                        setDeviceCode(begin.userCode);
                        setDeviceUri(begin.verificationUri);
                      })
                      .catch((cause: unknown) =>
                        setError(cause instanceof Error ? cause.message : String(cause)),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Sign in with GitHub
                </Button>
              )}
              {deviceCode && (
                <p>
                  Enter code <strong className="code-face">{deviceCode}</strong>
                  {deviceUri ? (
                    <>
                      {" "}
                      at{" "}
                      <a href={deviceUri} target="_blank" rel="noreferrer">
                        {deviceUri}
                      </a>
                    </>
                  ) : null}
                  . Waiting for approval…
                </p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setBusy(true);
                  setError(null);
                  void git
                    .storeGitHubToken(tokenDraft)
                    .then((next) => {
                      setAuth(next);
                      setTokenDraft("");
                    })
                    .catch((cause: unknown) =>
                      setError(cause instanceof Error ? cause.message : String(cause)),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                <label>
                  Or paste a fine-grained GitHub token
                  <input
                    type="password"
                    autoComplete="off"
                    value={tokenDraft}
                    placeholder="github_pat_…"
                    onChange={(event) => setTokenDraft(event.target.value)}
                    required
                  />
                </label>
                <p className="jam-git-pat-help">
                  Create one at GitHub → Settings → Developer settings → Personal access tokens →
                  Fine-grained tokens. Resource owner: your user. Repository access: only the song
                  repos you need. Permissions → Repository permissions →{" "}
                  <strong>Contents: Read and write</strong>. Metadata stays Read-only. No other
                  permissions. JamScript stores the token in this computer’s keychain and never
                  force-pushes.
                </p>
                <Button size="sm" type="submit" disabled={busy || !tokenDraft.trim()}>
                  Store token
                </Button>
              </form>
            </>
          )}
        </section>

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
              Push never forces. Pull only fast-forwards and refuses dirty or divergent folders.
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
