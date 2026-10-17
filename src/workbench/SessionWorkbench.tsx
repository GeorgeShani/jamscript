import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  FileCode2,
  Folder,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { EditorSlot } from "@/components/jam/EditorSlot";
import { musicModel } from "@/components/jam/code-editor";
import { SAMPLE_CODE } from "@/components/jam/session";
import { Button } from "@/components/ui/button";
import { TempoControl } from "@/features/tempo/TempoControl";
import { readTempo } from "@/features/tempo/tempo";
import { changeEditorTempo } from "@/features/tempo/tempo-editor";
import { deriveMusic, type MusicDocument } from "@/engine/music-document";
import type { EditorView } from "@codemirror/view";
import {
  createDocument,
  createWorkspace,
  deleteDocument,
  deleteWorkspace,
  listDocuments,
  listWorkspaces,
  renameDocument,
  renameWorkspace,
  saveDocument,
  type DocumentRecord,
  type WorkspaceRecord,
} from "@/workspaces/storage";
import { TrackInspector } from "./TrackInspector";
import { OutputPanel } from "./OutputPanel";
import { AuthControls } from "./AuthControls";

type SaveStatus = "saved" | "saving" | "error";

export function SessionWorkbench() {
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [newDocumentName, setNewDocumentName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 681px)").matches,
  );
  const [inspectorOpen, setInspectorOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 681px)").matches,
  );
  const [outputOpen, setOutputOpen] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playLoading, setPlayLoading] = useState(false);
  const [audioOutput, setAudioOutput] = useState<{ context: AudioContext; node: AudioNode } | null>(
    null,
  );
  const [tempo, setTempo] = useState(() => readTempo(""));
  const [, setReadyVersion] = useState(0);
  const views = useRef(new Map<string, EditorView>());
  const drafts = useRef(new Map<string, DocumentRecord>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const activeIdRef = useRef<string | null>(null);
  const code = useRef("");
  const playingNow = useRef(false);
  const mounted = useRef(true);
  const evaluation = useRef(0);
  const pendingEvaluation = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDocument = documents.find((item) => item.id === activeId) ?? null;
  const model = useMemo(() => deriveMusic(activeDocument?.source ?? ""), [activeDocument?.source]);
  const track = model.tracks.find((item) => item.name === selectedTrack) ?? model.tracks[0] ?? null;

  useEffect(() => {
    const evaluationCounter = evaluation;
    const saveTimers = timers;
    mounted.current = true;
    void listWorkspaces()
      .then(setWorkspaces)
      .catch((cause: unknown) => {
        setError(message(cause));
      })
      .finally(() => setLoadingWorkspaces(false));
    return () => {
      mounted.current = false;
      evaluationCounter.current++;
      if (pendingEvaluation.current) clearTimeout(pendingEvaluation.current);
      for (const timer of saveTimers.current.values()) clearTimeout(timer);
      for (const document of drafts.current.values()) void saveDocument(document);
      void import("@/engine/playback").then((pb) => {
        pb.onError(null);
        void pb.stop();
      });
    };
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
    setSaveStatus("saved");
    if (activeId) requestAnimationFrame(() => views.current.get(activeId)?.requestMeasure());
  }, [activeId]);

  useEffect(() => {
    code.current = activeDocument?.source ?? "";
    setTempo(readTempo(code.current));
  }, [activeDocument?.source]);

  const openWorkspace = async (next: WorkspaceRecord) => {
    try {
      setError(null);
      const items = await listDocuments(next.id);
      setWorkspace(next);
      setDocuments(items);
      drafts.current = new Map(items.map((item) => [item.id, item]));
      setOpenIds(items[0] ? [items[0].id] : []);
      setActiveId(items[0]?.id ?? null);
      setSelectedTrack(null);
      document.title = `${next.name} | JamScript`;
    } catch (cause) {
      setError(message(cause));
    }
  };

  const create = async (example: boolean) => {
    try {
      setError(null);
      const result = await createWorkspace(
        example ? "Night bus" : workspaceName,
        example ? SAMPLE_CODE : undefined,
      );
      setWorkspaceName("");
      setWorkspaces(await listWorkspaces());
      await openWorkspace(result.workspace);
    } catch (cause) {
      setError(message(cause));
    }
  };

  const scheduleSave = (next: DocumentRecord) => {
    drafts.current.set(next.id, next);
    const previous = timers.current.get(next.id);
    if (previous) clearTimeout(previous);
    if (activeIdRef.current === next.id) setSaveStatus("saving");
    timers.current.set(
      next.id,
      setTimeout(async () => {
        timers.current.delete(next.id);
        try {
          await saveDocument(drafts.current.get(next.id) ?? next);
          if (mounted.current && activeIdRef.current === next.id && !timers.current.has(next.id))
            setSaveStatus("saved");
        } catch (cause) {
          if (mounted.current) {
            setSaveStatus("error");
            setError(`Could not save ${next.name}: ${message(cause)}`);
          }
        }
      }, 450),
    );
  };

  const evaluateCurrent = useCallback(async () => {
    const request = ++evaluation.current;
    setPlayLoading(true);
    try {
      const playback = await import("@/engine/playback");
      if (!mounted.current || request !== evaluation.current) return;
      let reportedError: string | null = null;
      playback.onError((detail) => {
        reportedError = detail;
        if (mounted.current && request === evaluation.current) setPlayError(detail);
      });
      const ok = await playback.play(code.current);
      if (!mounted.current || request !== evaluation.current) return;
      if (ok) {
        playingNow.current = true;
        setPlaying(true);
        setPlayError(null);
        setAudioOutput(playback.getOutputNode());
      } else setPlayError(reportedError ?? "Could not evaluate the current document.");
    } catch (cause) {
      if (mounted.current) setPlayError(message(cause));
    } finally {
      if (mounted.current && request === evaluation.current) setPlayLoading(false);
    }
  }, []);

  const stopPlayback = async () => {
    playingNow.current = false;
    evaluation.current++;
    if (pendingEvaluation.current) clearTimeout(pendingEvaluation.current);
    setPlaying(false);
    setAudioOutput(null);
    const pb = await import("@/engine/playback");
    await pb.stop();
  };

  const handleCodeChange = (id: string, source: string, nextModel: MusicDocument) => {
    const current = drafts.current.get(id);
    if (!current) return;
    const next = { ...current, source };
    setDocuments((items) => items.map((item) => (item.id === id ? next : item)));
    scheduleSave(next);
    if (activeIdRef.current !== id) return;
    code.current = source;
    setTempo(readTempo(source));
    if (playingNow.current && nextModel.valid) {
      if (pendingEvaluation.current) clearTimeout(pendingEvaluation.current);
      pendingEvaluation.current = setTimeout(() => void evaluateCurrent(), 180);
    }
  };

  const selectDocument = (id: string) => {
    if (id === activeId) return;
    if (playingNow.current) void stopPlayback();
    setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setActiveId(id);
    setSelectedTrack(null);
  };

  const addDocument = async () => {
    if (!workspace) return;
    try {
      setError(null);
      const next = await createDocument(
        workspace.id,
        newDocumentName.endsWith(".js") ? newDocumentName : `${newDocumentName}.js`,
      );
      setDocuments((items) => [...items, next]);
      drafts.current.set(next.id, next);
      setNewDocumentName("");
      selectDocument(next.id);
    } catch (cause) {
      setError(message(cause));
    }
  };

  const applyRename = async (id: string, isWorkspace: boolean) => {
    try {
      if (isWorkspace) {
        const current = workspaces.find((item) => item.id === id);
        if (!current) return;
        const next = await renameWorkspace(current, renameValue);
        setWorkspaces((items) => items.map((item) => (item.id === id ? next : item)));
        if (workspace?.id === id) setWorkspace(next);
      } else {
        const current = drafts.current.get(id);
        if (!current) return;
        const next = await renameDocument(current, renameValue);
        drafts.current.set(id, next);
        setDocuments((items) => items.map((item) => (item.id === id ? next : item)));
      }
      setRenaming(null);
      setError(null);
    } catch (cause) {
      setError(message(cause));
    }
  };

  const removeDocument = async (item: DocumentRecord) => {
    if (!confirm(`Delete ${item.name}? This removes it from this browser.`)) return;
    try {
      const timer = timers.current.get(item.id);
      if (timer) clearTimeout(timer);
      timers.current.delete(item.id);
      await deleteDocument(item.id);
      drafts.current.delete(item.id);
      setDocuments((items) => items.filter((doc) => doc.id !== item.id));
      setOpenIds((ids) => ids.filter((id) => id !== item.id));
      if (activeId === item.id) {
        if (playingNow.current) void stopPlayback();
        const next = documents.find((doc) => doc.id !== item.id);
        setActiveId(next?.id ?? null);
        if (next) setOpenIds((ids) => (ids.includes(next.id) ? ids : [...ids, next.id]));
      }
    } catch (cause) {
      setError(message(cause));
    }
  };

  const leaveWorkspace = () => {
    if (playingNow.current) void stopPlayback();
    setWorkspace(null);
    setDocuments([]);
    setOpenIds([]);
    setActiveId(null);
    document.title = "JamScript";
    void listWorkspaces()
      .then(setWorkspaces)
      .catch((cause: unknown) => setError(message(cause)));
  };

  const activeView = activeId ? (views.current.get(activeId) ?? null) : null;
  const onTempoChange = (cps: number, expectedCps: number | null) => {
    const view = views.current.get(activeIdRef.current ?? "");
    return view !== undefined && changeEditorTempo(view, cps, expectedCps);
  };

  if (loadingWorkspaces) return <div className="jam-loading">Opening workspaces…</div>;

  if (!workspace)
    return (
      <main className="jam-chooser">
        <header>
          <img src="/brand/logo.svg" alt="JamScript" width={156} height={30} />
          <AuthControls />
        </header>
        <div className="jam-chooser-body">
          <p className="jam-eyebrow">YOUR MUSIC WORKSPACE</p>
          <h1>Make space for the next idea.</h1>
          <p className="jam-chooser-intro">
            Create a browser workspace to write and play Strudel music. Your documents stay in this
            browser.
          </p>
          {error && (
            <p role="alert" className="jam-error">
              <AlertCircle size={16} />
              {error}
            </p>
          )}
          <form
            className="jam-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void create(false);
            }}
          >
            <label htmlFor="workspace-name">New workspace</label>
            <div>
              <input
                id="workspace-name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Name your workspace"
                required
              />
              <Button type="submit">
                <FolderPlus size={16} /> Create
              </Button>
            </div>
          </form>
          <section className="jam-chooser-section" aria-labelledby="recent-heading">
            <h2 id="recent-heading">Recent workspaces</h2>
            {workspaces.length === 0 ? (
              <p className="jam-muted">No workspaces yet.</p>
            ) : (
              <ul>
                {workspaces.map((item) => (
                  <li key={item.id}>
                    {renaming === item.id ? (
                      <form
                        className="jam-inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void applyRename(item.id, true);
                        }}
                      >
                        <input
                          aria-label="Workspace name"
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          autoFocus
                        />
                        <Button size="sm" type="submit">
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => setRenaming(null)}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <button
                          className="jam-recent-open"
                          onClick={() => void openWorkspace(item)}
                        >
                          <Folder size={17} />
                          <span>{item.name}</span>
                          <small>{new Date(item.updatedAt).toLocaleDateString()}</small>
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRenaming(item.id);
                            setRenameValue(item.name);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${item.name}`}
                          onClick={async () => {
                            if (
                              !confirm(
                                `Delete ${item.name} and all its documents from this browser?`,
                              )
                            )
                              return;
                            try {
                              await deleteWorkspace(item.id);
                              setWorkspaces(await listWorkspaces());
                            } catch (cause) {
                              setError(message(cause));
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="jam-chooser-section" aria-labelledby="example-heading">
            <h2 id="example-heading">Start from an example</h2>
            <button className="jam-example" onClick={() => void create(true)}>
              <FileCode2 size={22} />
              <span>
                <strong>Night bus</strong>
                <small>A Strudel session you can edit, play and make your own.</small>
              </span>
              <span aria-hidden>↗</span>
            </button>
          </section>
        </div>
        <footer>
          Browser workspaces are stored locally.{" "}
          <a href="/licenses/THIRD_PARTY_NOTICES.txt">Licenses</a>
        </footer>
      </main>
    );

  return (
    <div className="jam-app-frame jam-workbench">
      <header className="jam-workbench-toolbar">
        <button
          className="jam-brand-button"
          onClick={leaveWorkspace}
          aria-label="Back to workspaces"
        >
          <img src="/brand/logo.svg" alt="JamScript" width={113} height={22} />
        </button>
        <span className="jam-toolbar-divider" aria-hidden />
        <button className="jam-workspace-switch" onClick={leaveWorkspace}>
          <ChevronLeft size={15} />
          {workspace.name}
        </button>
        <span className="jam-current-file">{activeDocument?.name ?? "No document"}</span>
        <div className="jam-transport">
          <TempoControl
            cps={tempo.cps}
            editable={!!activeDocument && tempo.editable}
            onCpsChange={onTempoChange}
          />
          <Button
            className="jam-play"
            size="sm"
            variant={playing ? "default" : "outline"}
            disabled={!activeDocument || playLoading}
            onClick={() => void (playing ? stopPlayback() : evaluateCurrent())}
          >
            {playing ? <Square size={16} /> : <Play size={16} />}
            {playLoading ? "Loading" : playing ? "Stop" : "Play"}
          </Button>
        </div>
        <AuthControls />
      </header>
      <div className="jam-workbench-main">
        <nav className="jam-activity-bar" aria-label="Workbench views">
          <button
            className={sidebarOpen ? "is-active" : ""}
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              if (!sidebarOpen && window.innerWidth <= 680) setInspectorOpen(false);
            }}
            aria-label={sidebarOpen ? "Hide files" : "Show files"}
          >
            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
          <button
            className={inspectorOpen ? "is-active" : ""}
            onClick={() => {
              setInspectorOpen(!inspectorOpen);
              if (!inspectorOpen && window.innerWidth <= 680) setSidebarOpen(false);
            }}
            aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
          >
            <span className="jam-inspector-glyph">◧</span>
          </button>
        </nav>
        {sidebarOpen && (
          <aside className="jam-file-sidebar">
            <div className="jam-panel-heading">
              <span>FILES</span>
              <button
                onClick={() => document.getElementById("new-document-name")?.focus()}
                aria-label="New document"
              >
                <Plus size={17} />
              </button>
            </div>
            <div className="jam-sidebar-workspace">
              <Folder size={15} />
              {workspace.name}
            </div>
            <form
              className="jam-new-file"
              onSubmit={(event) => {
                event.preventDefault();
                void addDocument();
              }}
            >
              <input
                id="new-document-name"
                aria-label="New document name"
                placeholder="new-file.js"
                value={newDocumentName}
                onChange={(event) => setNewDocumentName(event.target.value)}
                required
              />
              <button type="submit" aria-label="Create document">
                <Plus size={16} />
              </button>
            </form>
            <ul className="jam-file-list">
              {documents.map((item) => (
                <li key={item.id}>
                  {renaming === item.id ? (
                    <form
                      className="jam-inline-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void applyRename(item.id, false);
                      }}
                    >
                      <input
                        aria-label="Document name"
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        autoFocus
                      />
                      <button type="submit">Save</button>
                      <button type="button" onClick={() => setRenaming(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        className={`jam-file-button ${item.id === activeId ? "is-active" : ""}`}
                        onClick={() => selectDocument(item.id)}
                      >
                        <FileCode2 size={15} />
                        <span>{item.name}</span>
                      </button>
                      <button
                        className="jam-file-action"
                        aria-label={`Rename ${item.name}`}
                        onClick={() => {
                          setRenaming(item.id);
                          setRenameValue(item.name);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="jam-file-action"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => void removeDocument(item)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}
        <div className="jam-editor-column">
          <div className="jam-tabs" role="tablist" aria-label="Open documents">
            {openIds.map((id) => {
              const item = documents.find((doc) => doc.id === id);
              return (
                item && (
                  <div className={`jam-tab ${id === activeId ? "is-active" : ""}`} key={id}>
                    <button
                      role="tab"
                      aria-selected={id === activeId}
                      onClick={() => selectDocument(id)}
                    >
                      <FileCode2 size={14} />
                      {item.name}
                    </button>
                    <button
                      className="jam-tab-close"
                      aria-label={`Close ${item.name} tab`}
                      onClick={() => {
                        setOpenIds((ids) => ids.filter((open) => open !== id));
                        if (activeId === id)
                          setActiveId(openIds.find((open) => open !== id) ?? null);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              );
            })}
          </div>
          <div className="jam-editor-stage">
            {openIds.length ? (
              openIds.map((id) => {
                const item = documents.find((doc) => doc.id === id);
                return (
                  item && (
                    <div
                      key={id}
                      className="jam-editor-pane"
                      hidden={id !== activeId}
                      inert={id !== activeId}
                    >
                      <EditorSlot
                        initialCode={item.source}
                        onReady={(view) => {
                          if (view) {
                            views.current.set(id, view);
                            setReadyVersion((value) => value + 1);
                            const sync = () => {
                              if (activeIdRef.current !== id) return;
                              const position = view.state.selection.main.head;
                              const found = view.state
                                .field(musicModel)
                                .tracks.find(
                                  (candidate) =>
                                    position >= candidate.from && position <= candidate.to,
                                );
                              if (found) setSelectedTrack(found.name);
                            };
                            view.dom.addEventListener("click", sync);
                            view.dom.addEventListener("keyup", sync);
                          } else views.current.delete(id);
                        }}
                        onChange={(source, nextModel) => handleCodeChange(id, source, nextModel)}
                        onEvaluate={() => {
                          if (activeIdRef.current === id) void evaluateCurrent();
                        }}
                      />
                    </div>
                  )
                );
              })
            ) : (
              <div className="jam-empty-editor">
                <FileCode2 size={32} />
                <h2>No document open</h2>
                <p>Select a file or create a new one to start writing music.</p>
              </div>
            )}
          </div>
          {outputOpen && (
            <OutputPanel
              error={playError ?? error}
              output={audioOutput}
              playing={playing}
              onDismiss={() => {
                setPlayError(null);
                setError(null);
              }}
            />
          )}
        </div>
        {inspectorOpen && (
          <TrackInspector
            track={track}
            tracks={model.tracks}
            valid={model.valid}
            view={activeView}
            onSelectTrack={setSelectedTrack}
          />
        )}
      </div>
      <footer className="jam-statusbar">
        <span>{playing ? "● Playing" : "○ Stopped"}</span>
        <span>
          {saveStatus === "error"
            ? "Save failed"
            : saveStatus === "saving"
              ? "Saving…"
              : "Saved locally"}
        </span>
        <button onClick={() => setOutputOpen(!outputOpen)}>
          {outputOpen ? "Hide output" : "Show output"}
        </button>
        <a href="/licenses/THIRD_PARTY_NOTICES.txt">Licenses</a>
      </footer>
    </div>
  );
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
