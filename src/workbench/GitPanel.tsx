import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  GitBranch,
  Link2,
  RefreshCw,
  Files,
  GitCommitHorizontal,
} from "lucide-react";
import type { DocumentRecord, WorkspaceStorage } from "@/workspaces/storage";
import { GitFeedback, type GitFeedbackState, type GitOperation } from "./GitFeedback";

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
  const [feedback, setFeedback] = useState<GitFeedbackState | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cloneUrl, setCloneUrl] = useState("");
  const [originUrl, setOriginUrl] = useState("");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [deviceUri, setDeviceUri] = useState<string | null>(null);
  const currentDocuments = useRef(documents);
  const panel = useRef<HTMLDivElement>(null);
  const [motionVisible, setMotionVisible] = useState(true);
  useEffect(() => {
    let inView = true;
    const update = () => setMotionVisible(inView && !document.hidden);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? true;
            update();
          });
    if (panel.current) observer?.observe(panel.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    currentDocuments.current = documents;
  }, [documents]);

  const refresh = useCallback(
    (notify = false) => {
      setRefreshing(true);
      if (notify) setFeedback({ operation: "refresh", phase: "pending", text: "Reading status…" });
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
                currentDocuments.current.some((document) => document.name === file.name),
            )
            .map((file) => file.name);
          setSelected((current) =>
            current.length ? current.filter((name) => names.includes(name)) : names,
          );
          if (notify)
            setFeedback({ operation: "refresh", phase: "success", text: "Status refreshed" });
        })
        .catch((cause: unknown) => {
          const text = cause instanceof Error ? cause.message : String(cause);
          if (text.includes("No Git repository")) {
            setMissing(true);
            setStatus(null);
            if (notify)
              setFeedback({ operation: "refresh", phase: "success", text: "No repository yet" });
          } else {
            if (notify)
              setFeedback({ operation: "refresh", phase: "error", text: "Status check failed" });
            setError(text);
          }
        })
        .finally(() => setRefreshing(false));
      void git
        .githubAuthStatus()
        .then(setAuth)
        .catch(() => setAuth({ signedIn: false, deviceFlowAvailable: false }));
    },
    [git, workspaceId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const run = async (
    action: () => Promise<GitState>,
    filesChanged = false,
    label = "Updating repository…",
    operation: GitOperation = "repository",
  ) => {
    setBusy(true);
    setFeedback({ operation, phase: "pending", text: label });
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
      const completed = {
        push: "Push complete",
        pull: "Pull complete",
        commit: "Commit created",
        refresh: "Status refreshed",
        repository: "Repository updated",
      };
      setFeedback({ operation, phase: "success", text: completed[operation] });
    } catch (cause) {
      setFeedback({
        operation,
        phase: "error",
        text:
          operation === "push"
            ? "Push failed"
            : operation === "pull"
              ? "Pull failed"
              : "Operation failed",
      });
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
  const selectedUnsaved = documents.some(
    (document) => selected.includes(document.name) && isDirty(document),
  );
  const canCommit = selected.length > 0 && !!message.trim() && !busy && !selectedUnsaved;
  const commitSelected = () => {
    if (!canCommit) return;
    const files = documents.filter(
      (document) =>
        selected.includes(document.name) &&
        eligible.some((file) => file.name === document.name && file.status !== "deleted"),
    );
    const deleted = eligible
      .filter((file) => file.status === "deleted" && selected.includes(file.name))
      .map((file) => file.name);
    void run(
      () => git.commit(workspaceId, files, deleted, message),
      false,
      "Creating commit…",
      "commit",
    );
  };

  return (
    <div ref={panel} className="jam-git-sidebar" data-motion-paused={!motionVisible}>
      <header className="jam-git-status">
        <GitBranch size={14} aria-hidden="true" />
        <span className="jam-git-status-text">
          {missing
            ? "Set up Git"
            : status
              ? (status.branch ?? "First commit")
              : "Reading repository…"}
        </span>
        <button
          type="button"
          className="jam-git-icon-btn"
          disabled={busy || refreshing}
          data-pending={refreshing}
          aria-label="Refresh"
          title="Refresh status"
          onClick={() => refresh(true)}
        >
          <RefreshCw size={14} />
        </button>
      </header>

      {missing ? (
        <div className="jam-git-stack">
          {feedback && (
            <GitFeedback key={`${feedback.operation}:${feedback.phase}`} state={feedback} />
          )}
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
      ) : status ? (
        <>
          <div className="jam-git-toolbar" role="group" aria-label="Git actions">
            <button
              type="button"
              className="jam-git-tool"
              data-direction="pull"
              data-pending={feedback?.operation === "pull" && feedback.phase === "pending"}
              data-complete={feedback?.operation === "pull" && feedback.phase === "success"}
              disabled={busy || dirtyOpen || !status?.hasOrigin}
              title={
                dirtyOpen
                  ? "Save open files first"
                  : !status?.hasOrigin
                    ? "Add origin first"
                    : "Pull (fast-forward)"
              }
              onClick={() =>
                void run(() => git.pull(workspaceId, documents), true, "Fetching changes…", "pull")
              }
            >
              {feedback?.operation === "pull" && feedback.phase === "success" ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <ArrowDownToLine size={15} aria-hidden="true" />
              )}
              Pull
            </button>
            <button
              type="button"
              className="jam-git-tool"
              data-direction="push"
              data-pending={feedback?.operation === "push" && feedback.phase === "pending"}
              data-complete={feedback?.operation === "push" && feedback.phase === "success"}
              disabled={busy || !status?.hasOrigin}
              title={!status?.hasOrigin ? "Add origin first" : "Push (never force)"}
              onClick={() =>
                void run(() => git.push(workspaceId), false, "Pushing commits…", "push")
              }
            >
              {feedback?.operation === "push" && feedback.phase === "success" ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <ArrowUpFromLine size={15} aria-hidden="true" />
              )}
              Push
            </button>
          </div>

          {feedback && (
            <GitFeedback key={`${feedback.operation}:${feedback.phase}`} state={feedback} />
          )}

          <details className="jam-git-remote" open={!status.hasOrigin}>
            <summary>
              <Link2 size={13} aria-hidden="true" />
              {status.hasOrigin ? "Remote repository" : "Connect a remote"}
            </summary>
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
          </details>

          <section className="jam-git-changes" aria-label="Working tree changes">
            <header>
              <span>Changes</span>
              <span>{eligible.length}</span>
            </header>
            <div className={`jam-git-files${eligible.length ? " has-changes" : ""}`}>
              {eligible.length === 0 ? (
                <div className="jam-git-empty" role="status">
                  {status.files.length ? (
                    <Files size={20} aria-hidden="true" />
                  ) : (
                    <Check size={20} aria-hidden="true" />
                  )}
                  <div>
                    <strong>
                      {status.files.length
                        ? "No music file changes"
                        : status.branch
                          ? "No local changes"
                          : "Ready for your first commit"}
                    </strong>
                    <p>
                      {status.files.length
                        ? "Other files have changes. Manage them in your Git client."
                        : status.branch
                          ? "Saved files match the last commit."
                          : "Save a music file to start your repository."}
                    </p>
                    {dirtyOpen && <p>Save your open files to include their edits.</p>}
                  </div>
                </div>
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
          </section>

          {eligible.length > 0 && (
            <form
              className="jam-git-commit"
              onSubmit={(event) => {
                event.preventDefault();
                commitSelected();
              }}
            >
              <label htmlFor="jam-git-message">Commit message</label>
              <input
                id="jam-git-message"
                className="jam-git-message"
                value={message}
                maxLength={500}
                aria-label="Commit message"
                placeholder="Describe your changes"
                onChange={(event) => setMessage(event.target.value)}
              />
              <button type="submit" className="jam-git-primary" disabled={!canCommit}>
                <GitCommitHorizontal size={15} aria-hidden="true" />
                Commit<span aria-hidden="true">{selected.length}</span>
              </button>
              {selectedUnsaved && (
                <p className="jam-git-hint">Save selected files before committing.</p>
              )}
            </form>
          )}
        </>
      ) : (
        <p className="jam-git-hint" role="status">
          {refreshing ? "Checking saved files…" : "Repository status unavailable. Try Refresh."}
        </p>
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
