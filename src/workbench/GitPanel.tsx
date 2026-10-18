import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  GitBranch,
  Link2,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import type { DocumentRecord, WorkspaceStorage } from "@/workspaces/storage";

type GitService = NonNullable<WorkspaceStorage["git"]>;
type GitState = Awaited<ReturnType<GitService["status"]>>;
type AuthState = Awaited<ReturnType<GitService["githubAuthStatus"]>>;

/** Compact desktop Git sidebar — essential actions without terminal chrome. */
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
  const [originUrl, setOriginUrl] = useState("");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [deviceUri, setDeviceUri] = useState<string | null>(null);

  const refresh = () => {
    setError(null);
    void git
      .status(workspaceId)
      .then((value) => {
        setStatus(value);
        setMissing(false);
        setOriginUrl(value.originUrl ?? "");
        const names = value.files
          .filter(
            (file) =>
              file.status === "deleted" ||
              documents.some((document) => document.name === file.name),
          )
          .map((file) => file.name);
        setSelected((current) =>
          current.length ? current.filter((name) => names.includes(name)) : names,
        );
      })
      .catch((cause: unknown) => {
        const text = cause instanceof Error ? cause.message : String(cause);
        if (text.includes("No Git repository")) {
          setMissing(true);
          setStatus(null);
        } else setError(text);
      });
    void git
      .githubAuthStatus()
      .then(setAuth)
      .catch(() => setAuth({ signedIn: false, deviceFlowAvailable: false }));
  };

  useEffect(() => {
    refresh();
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
      const next = await action();
      setStatus(next);
      setMissing(false);
      setMessage("");
      setOriginUrl(next.originUrl ?? "");
      const names = next.files
        .filter(
          (file) =>
            file.status === "deleted" || documents.some((document) => document.name === file.name),
        )
        .map((file) => file.name);
      setSelected(names);
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
  const dirtyOpen = documents.some(isDirty);
  const canCommit = selected.length > 0 && !!message.trim() && !busy;

  return (
    <div className="jam-git-sidebar">
      <header className="jam-git-status">
        <GitBranch size={14} aria-hidden="true" />
        <span className="jam-git-status-text">
          {missing ? "No repo yet" : `${status?.branch ?? "unborn"} · ${status?.files.length ?? 0}`}
        </span>
        <button
          type="button"
          className="jam-git-icon-btn"
          disabled={busy}
          aria-label="Refresh"
          title="Refresh status"
          onClick={() => refresh()}
        >
          {busy ? <LoaderCircle size={14} className="jam-git-spin" /> : <RefreshCw size={14} />}
        </button>
      </header>

      {missing ? (
        <div className="jam-git-stack">
          <button
            type="button"
            className="jam-git-primary"
            disabled={busy}
            onClick={() => void run(() => git.initialize(workspaceId))}
          >
            Init repository
          </button>
          <form
            className="jam-git-inline"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => git.cloneInto(workspaceId, cloneUrl), true);
            }}
          >
            <input
              type="url"
              value={cloneUrl}
              aria-label="Clone URL"
              placeholder="Clone HTTPS URL…"
              onChange={(event) => setCloneUrl(event.target.value)}
              required
            />
            <button
              type="submit"
              className="jam-git-secondary"
              disabled={busy || !cloneUrl.startsWith("https://") || documents.length > 0}
            >
              Clone
            </button>
          </form>
          {documents.length > 0 && <p className="jam-git-hint">Empty folder required to clone.</p>}
        </div>
      ) : (
        <>
          <div className="jam-git-toolbar" role="group" aria-label="Git actions">
            <button
              type="button"
              className="jam-git-tool"
              disabled={busy || dirtyOpen || !status?.hasOrigin}
              title={
                dirtyOpen
                  ? "Save open files first"
                  : !status?.hasOrigin
                    ? "Add origin first"
                    : "Pull (fast-forward)"
              }
              onClick={() => void run(() => git.pull(workspaceId, documents), true)}
            >
              <ArrowDownToLine size={15} aria-hidden="true" />
              Pull
            </button>
            <button
              type="button"
              className="jam-git-tool"
              disabled={busy || !status?.hasOrigin}
              title={!status?.hasOrigin ? "Add origin first" : "Push (never force)"}
              onClick={() => void run(() => git.push(workspaceId))}
            >
              <ArrowUpFromLine size={15} aria-hidden="true" />
              Push
            </button>
            <button
              type="button"
              className="jam-git-tool is-accent"
              disabled={!canCommit}
              title="Commit selected files"
              onClick={() => {
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
              <Check size={15} aria-hidden="true" />
              Commit
            </button>
          </div>

          <form
            className="jam-git-inline"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => git.setOrigin(workspaceId, originUrl));
            }}
          >
            <Link2 size={14} className="jam-git-inline-icon" aria-hidden="true" />
            <input
              type="url"
              value={originUrl}
              aria-label="Remote origin"
              placeholder="origin HTTPS…"
              onChange={(event) => setOriginUrl(event.target.value)}
              required
            />
            <button
              type="submit"
              className="jam-git-secondary"
              disabled={busy || !originUrl.startsWith("https://")}
            >
              {status?.hasOrigin ? "Set" : "Add"}
            </button>
          </form>

          <div className="jam-git-files">
            {eligible.length === 0 ? (
              <p className="jam-git-hint">Working tree clean.</p>
            ) : (
              <ul>
                {eligible.map((file) => {
                  const document = documents.find((item) => item.name === file.name);
                  const dirty = document ? isDirty(document) : false;
                  return (
                    <li key={file.name}>
                      <label className={dirty ? "is-blocked" : undefined}>
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
                        <span className="jam-git-file-name">{file.name}</span>
                        <span className="jam-git-file-flag">
                          {dirty ? "save" : file.status.slice(0, 1)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <input
            className="jam-git-message"
            value={message}
            maxLength={500}
            aria-label="Commit message"
            placeholder="Commit message…"
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canCommit) {
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
              }
            }}
          />
        </>
      )}

      <details className="jam-git-auth">
        <summary>{auth?.signedIn ? "GitHub · connected" : "GitHub · sign in"}</summary>
        {auth?.signedIn ? (
          <button
            type="button"
            className="jam-git-link"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void git
                .signOutGitHub()
                .then(setAuth)
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : String(cause)),
                )
                .finally(() => setBusy(false));
            }}
          >
            Sign out
          </button>
        ) : (
          <div className="jam-git-stack">
            {auth?.deviceFlowAvailable && (
              <button
                type="button"
                className="jam-git-secondary"
                disabled={busy || !!deviceCode}
                onClick={() => {
                  setBusy(true);
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
                Device sign-in
              </button>
            )}
            {deviceCode && (
              <p className="jam-git-hint">
                Code <strong className="code-face">{deviceCode}</strong>
                {deviceUri ? (
                  <>
                    {" "}
                    →{" "}
                    <a href={deviceUri} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  </>
                ) : null}
              </p>
            )}
            <form
              className="jam-git-inline"
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
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
              <input
                type="password"
                autoComplete="off"
                value={tokenDraft}
                aria-label="GitHub token"
                placeholder="github_pat_…"
                onChange={(event) => setTokenDraft(event.target.value)}
                required
              />
              <button
                type="submit"
                className="jam-git-secondary"
                disabled={busy || !tokenDraft.trim()}
              >
                Store
              </button>
            </form>
            <p className="jam-git-hint">PAT needs Contents: Read and write.</p>
          </div>
        )}
      </details>

      {error && (
        <p role="alert" className="jam-git-error">
          {error}
        </p>
      )}
    </div>
  );
}
