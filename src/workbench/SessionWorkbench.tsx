import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isolateHistory } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import {
  AlertCircle,
  ChevronLeft,
  FileCode2,
  Folder,
  FolderPlus,
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Square,
  SlidersVertical,
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
import { prepareMix, renameTrackPatch } from "@/engine/mix-source";
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
import { AuthControls } from "@/workbench/AuthControls";
import { ExportControl } from "./ExportControl";

type SaveStatus = "saved" | "saving" | "error";
type PaneSide = "files" | "inspector";
const PANE_LIMITS = { files: { min: 170, max: 340 }, inspector: { min: 190, max: 360 } } as const;
const OUTPUT_LIMITS = { min: 110, max: 500 } as const;
const EMPTY_LEVELS: Record<string, number> = {};

function storedPaneWidth(side: PaneSide, fallback: number) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = Number(window.localStorage.getItem(`jamscript-${side}-width`));
    return Number.isFinite(value) &&
      value >= PANE_LIMITS[side].min &&
      value <= PANE_LIMITS[side].max
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}

function storedOutputHeight() {
  if (typeof window === "undefined") return 174;
  try {
    const value = Number(window.localStorage.getItem("jamscript-output-height"));
    return Number.isFinite(value) && value >= OUTPUT_LIMITS.min && value <= OUTPUT_LIMITS.max
      ? value
      : 174;
  } catch {
    return 174;
  }
}

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
  const [outputHeight, setOutputHeight] = useState(storedOutputHeight);
  const [filesWidth, setFilesWidth] = useState(() => storedPaneWidth("files", 232));
  const [inspectorWidth, setInspectorWidth] = useState(() => storedPaneWidth("inspector", 256));
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [soloTrack, setSoloTrack] = useState<string | null>(null);
  const [playLoading, setPlayLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [audioOutput, setAudioOutput] = useState<{ context: AudioContext; node: AudioNode } | null>(
    null,
  );
  const [tempo, setTempo] = useState(() => readTempo(""));
  const [, setReadyVersion] = useState(0);
  const views = useRef(new Map<string, EditorView>());
  const mainPane = useRef<HTMLDivElement>(null);
  const editorColumn = useRef<HTMLDivElement>(null);
  const paneDrag = useRef<{ side: PaneSide; startX: number; startWidth: number } | null>(null);
  const outputDrag = useRef<{ startY: number; startHeight: number } | null>(null);
  const drafts = useRef(new Map<string, DocumentRecord>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const activeIdRef = useRef<string | null>(null);
  const code = useRef("");
  const playingNow = useRef(false);
  const mounted = useRef(true);
  const evaluation = useRef(0);
  const pendingEvaluation = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportAbort = useRef<AbortController | null>(null);
  const exportingNow = useRef(false);

  const activeDocument = documents.find((item) => item.id === activeId) ?? null;
  const model = useMemo(() => deriveMusic(activeDocument?.source ?? ""), [activeDocument?.source]);
  const mixTracks = useMemo(
    () => prepareMix(activeDocument?.source ?? "").tracks,
    [activeDocument?.source],
  );
  const mixLevels = activeDocument?.mix?.levels ?? EMPTY_LEVELS;
  const mixColors = activeDocument?.mix?.colors ?? EMPTY_LEVELS;
  const masterLevel = activeDocument?.mix?.master ?? 1;
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
      exportAbort.current?.abort();
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

  useEffect(() => {
    const activeSolo = mixTracks.some((item) => item.id === soloTrack) ? soloTrack : null;
    if (!exportingNow.current)
      void import("@/engine/playback").then((playback) =>
        playback.setMix(mixLevels, activeSolo, masterLevel),
      );
  }, [mixLevels, masterLevel, soloTrack, mixTracks]);

  useEffect(() => {
    if (soloTrack && !mixTracks.some((item) => item.id === soloTrack)) setSoloTrack(null);
  }, [mixTracks, soloTrack]);

  useEffect(() => {
    if (!sidebarOpen || !inspectorOpen) return;
    const fitPanes = () => {
      const width = mainPane.current?.clientWidth || window.innerWidth;
      const available = width - 46 - 12 - (window.innerWidth < 900 ? 280 : 420);
      if (filesWidth + inspectorWidth <= available) return;
      const nextInspector = Math.max(PANE_LIMITS.inspector.min, available - filesWidth);
      const nextFiles = Math.max(PANE_LIMITS.files.min, available - nextInspector);
      setInspectorWidth(nextInspector);
      setFilesWidth(nextFiles);
    };
    fitPanes();
    window.addEventListener("resize", fitPanes);
    return () => window.removeEventListener("resize", fitPanes);
  }, [filesWidth, inspectorWidth, sidebarOpen, inspectorOpen]);

  const changeMix = (master: number, levels: Record<string, number>) => {
    if (!activeId) return;
    const current = drafts.current.get(activeId);
    if (!current) return;
    const next = { ...current, mix: { ...current.mix, master, levels } };
    setDocuments((items) => items.map((item) => (item.id === activeId ? next : item)));
    scheduleSave(next);
  };

  const changeTrackColor = (orbit: number, color: number) => {
    if (!activeId || exportingNow.current || !Number.isInteger(color) || color < 1 || color > 6)
      return;
    const current = drafts.current.get(activeId);
    if (!current) return;
    const next = {
      ...current,
      mix: {
        master: current.mix?.master ?? 1,
        levels: current.mix?.levels ?? {},
        colors: { ...current.mix?.colors, [String(orbit)]: color },
      },
    };
    setDocuments((items) => items.map((item) => (item.id === activeId ? next : item)));
    scheduleSave(next);
  };

  const renameTrack = (id: string, name: string) => {
    if (!activeId || exportingNow.current) return false;
    const view = views.current.get(activeId);
    if (!view) return false;
    const patch = renameTrackPatch(view.state.doc.toString(), id, name);
    if (!patch) return false;
    view.dispatch({
      changes: patch,
      annotations: [Transaction.userEvent.of("input.type.track-rename"), isolateHistory.of("full")],
    });
    return true;
  };

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
      const current = drafts.current.get(activeIdRef.current ?? "");
      playback.setMix(current?.mix?.levels ?? {}, soloTrack, current?.mix?.master ?? 1);
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
  }, [soloTrack]);

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
    const before = prepareMix(current.source).tracks;
    const after = prepareMix(source).tracks;
    const renamed = new Map<string, string>();
    if (before.length === after.length)
      before.forEach((item, index) => {
        const replacement = after[index];
        if (replacement && item.name !== replacement.name) renamed.set(item.name, replacement.name);
      });
    const levels = { ...current.mix?.levels };
    for (const [oldName, newName] of renamed) {
      if (Object.hasOwn(levels, oldName)) {
        levels[newName] = levels[oldName]!;
        delete levels[oldName];
      }
    }
    const next = {
      ...current,
      source,
      ...(current.mix ? { mix: { ...current.mix, levels } } : {}),
    };
    setDocuments((items) => items.map((item) => (item.id === id ? next : item)));
    scheduleSave(next);
    if (activeIdRef.current !== id) return;
    if (renamed.size) {
      setSelectedTrack((selected) => renamed.get(selected ?? "") ?? selected);
      setSoloTrack((solo) => renamed.get(solo ?? "") ?? solo);
    }
    code.current = source;
    setTempo(readTempo(source));
    if (playingNow.current && nextModel.valid && !exportingNow.current) {
      if (pendingEvaluation.current) clearTimeout(pendingEvaluation.current);
      pendingEvaluation.current = setTimeout(() => void evaluateCurrent(), 180);
    }
  };

  const selectDocument = (id: string) => {
    if (id === activeId) return;
    exportAbort.current?.abort();
    if (playingNow.current) void stopPlayback();
    setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setActiveId(id);
    setSelectedTrack(null);
    setSoloTrack(null);
  };

  const exportMain = async (format: "wav" | "mp3", bars: number) => {
    if (!activeDocument || exportingNow.current) return;
    const abort = new AbortController();
    exportAbort.current = abort;
    exportingNow.current = true;
    setExporting(true);
    setExportProgress(0);
    setPlayError(null);
    try {
      if (playingNow.current) await stopPlayback();
      const { recordMainFlow, encodeWav, encodeMp3 } = await import("@/engine/export-audio");
      const current = drafts.current.get(activeDocument.id) ?? activeDocument;
      const recording = await recordMainFlow({
        code: current.source,
        cps: readTempo(current.source).cps ?? 0,
        bars,
        levels: current.mix?.levels ?? EMPTY_LEVELS,
        master: current.mix?.master ?? 1,
        signal: abort.signal,
        onProgress: setExportProgress,
      });
      if (abort.signal.aborted) return;
      const blob =
        format === "wav" ? encodeWav(recording) : await encodeMp3(recording, abort.signal);
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${current.name.replace(/\.[^.]+$/, "")}-${bars}bars.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        setPlayError(message(cause));
    } finally {
      exportingNow.current = false;
      exportAbort.current = null;
      setExporting(false);
      setPlaying(false);
      setAudioOutput(null);
      const latest = drafts.current.get(activeIdRef.current ?? "");
      void import("@/engine/playback").then((pb) =>
        pb.setMix(
          latest?.mix?.levels ?? EMPTY_LEVELS,
          activeIdRef.current === activeDocument.id ? soloTrack : null,
          latest?.mix?.master ?? 1,
        ),
      );
    }
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
    document.title = "JamScript | Workspaces";
    void listWorkspaces()
      .then(setWorkspaces)
      .catch((cause: unknown) => setError(message(cause)));
  };

  const activeView = activeId ? (views.current.get(activeId) ?? null) : null;
  const paneMaximum = (side: PaneSide) => {
    const minCenter = window.innerWidth < 900 ? 280 : 420;
    const otherWidth =
      side === "files" && inspectorOpen
        ? inspectorWidth
        : side === "inspector" && sidebarOpen
          ? filesWidth
          : 0;
    const room =
      (mainPane.current?.clientWidth || window.innerWidth) - 46 - otherWidth - minCenter - 12;
    return Math.max(PANE_LIMITS[side].min, Math.min(PANE_LIMITS[side].max, room));
  };
  const resizePane = (side: PaneSide, requestedWidth: number) => {
    const width = Math.round(
      Math.max(PANE_LIMITS[side].min, Math.min(paneMaximum(side), requestedWidth)),
    );
    (side === "files" ? setFilesWidth : setInspectorWidth)(width);
    return width;
  };
  const onPanePointerDown = (side: PaneSide, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    paneDrag.current = {
      side,
      startX: event.clientX,
      startWidth: side === "files" ? filesWidth : inspectorWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPanePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = paneDrag.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    resizePane(drag.side, drag.startWidth + (drag.side === "files" ? delta : -delta));
  };
  const onPanePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = paneDrag.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    const width = resizePane(drag.side, drag.startWidth + (drag.side === "files" ? delta : -delta));
    try {
      window.localStorage.setItem(`jamscript-${drag.side}-width`, String(width));
    } catch {
      /* layout still works without persistence */
    }
    paneDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onPaneKeyDown = (side: PaneSide, event: React.KeyboardEvent<HTMLDivElement>) => {
    const direction = side === "files" ? 1 : -1;
    const current = side === "files" ? filesWidth : inspectorWidth;
    let next: number;
    if (event.key === "Home") next = PANE_LIMITS[side].min;
    else if (event.key === "End") next = paneMaximum(side);
    else if (event.key === "ArrowRight") next = current + direction * 16;
    else if (event.key === "ArrowLeft") next = current - direction * 16;
    else return;
    event.preventDefault();
    const width = resizePane(side, next);
    try {
      window.localStorage.setItem(`jamscript-${side}-width`, String(width));
    } catch {
      /* layout still works without persistence */
    }
  };
  const outputMaximum = () => {
    const columnHeight =
      editorColumn.current?.clientHeight || Math.max(320, window.innerHeight - 120);
    return Math.max(OUTPUT_LIMITS.min, Math.min(OUTPUT_LIMITS.max, columnHeight - 36 - 200));
  };
  const resizeOutput = (requestedHeight: number) => {
    const height = Math.round(
      Math.max(OUTPUT_LIMITS.min, Math.min(outputMaximum(), requestedHeight)),
    );
    setOutputHeight(height);
    return height;
  };
  const persistOutputHeight = (height: number) => {
    try {
      window.localStorage.setItem("jamscript-output-height", String(height));
    } catch {
      /* resizing still works without persistence */
    }
  };
  const onOutputPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    outputDrag.current = { startY: event.clientY, startHeight: outputHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onOutputPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = outputDrag.current;
    if (drag) resizeOutput(drag.startHeight + drag.startY - event.clientY);
  };
  const onOutputPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = outputDrag.current;
    if (!drag) return;
    persistOutputHeight(resizeOutput(drag.startHeight + drag.startY - event.clientY));
    outputDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onOutputKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    if (event.key === "Home") next = OUTPUT_LIMITS.min;
    else if (event.key === "End") next = outputMaximum();
    else if (event.key === "ArrowUp") next = outputHeight + 16;
    else if (event.key === "ArrowDown") next = outputHeight - 16;
    else return;
    event.preventDefault();
    persistOutputHeight(resizeOutput(next));
  };
  useEffect(() => {
    const fitOutput = () => setOutputHeight((height) => Math.min(height, outputMaximum()));
    fitOutput();
    window.addEventListener("resize", fitOutput);
    return () => window.removeEventListener("resize", fitOutput);
  }, [workspace]);
  const onTempoChange = (cps: number, expectedCps: number | null) => {
    const view = views.current.get(activeIdRef.current ?? "");
    return view !== undefined && changeEditorTempo(view, cps, expectedCps);
  };

  if (loadingWorkspaces) return <div className="jam-loading">Opening workspaces…</div>;

  if (!workspace)
    return (
      <main className="jam-chooser">
        <header>
          {import.meta.env.MODE === "desktop" ? (
            <img src="/brand/logo.svg" alt="JamScript" width={156} height={30} />
          ) : (
            <a href="/" aria-label="JamScript website">
              <img src="/brand/logo.svg" alt="JamScript" width={156} height={30} />
            </a>
          )}
          <div className="jam-chooser-header-actions">
            {import.meta.env.MODE !== "desktop" && (
              <a href="/">
                Website <ArrowUpRight size={14} />
              </a>
            )}
            <AuthControls />
          </div>
        </header>
        <div className="jam-chooser-body">
          <div className="jam-chooser-primary">
            <p className="jam-eyebrow">YOUR MUSIC STUDIO</p>
            <h1>
              Where should we
              <br />
              <em>start playing?</em>
            </h1>
            <p className="jam-chooser-intro">
              Open a session or make a new space for your music. Your workspaces save locally as you
              work.
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
              <label htmlFor="workspace-name">CREATE A WORKSPACE</label>
              <div>
                <input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Your next project name"
                  required
                />
                <Button type="submit">
                  <FolderPlus size={16} /> Create
                </Button>
              </div>
            </form>
            <p className="jam-chooser-privacy">Saved locally · No account required</p>
          </div>
          <div className="jam-chooser-secondary">
            <section className="jam-chooser-section" aria-labelledby="recent-heading">
              <h2 id="recent-heading">Pick up a workspace</h2>
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
                            <small>
                              {new Date(item.updatedAt).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </small>
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
              <h2 id="example-heading">Or start with a song</h2>
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
        </div>
        <footer>
          Workspaces are stored locally. <a href="/licenses/THIRD_PARTY_NOTICES.txt">Licenses</a>
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
            editable={!!activeDocument && tempo.editable && !exporting}
            onCpsChange={onTempoChange}
          />
          <ExportControl
            disabled={!activeDocument || tempo.cps === null || !tempo.editable}
            exporting={exporting}
            progress={exportProgress}
            onExport={(format, bars) => void exportMain(format, bars)}
            onCancel={() => exportAbort.current?.abort()}
          />
          <Button
            className="jam-play"
            size="sm"
            variant={playing ? "default" : "outline"}
            disabled={!activeDocument || playLoading || exporting}
            onClick={() => void (playing ? stopPlayback() : evaluateCurrent())}
          >
            {playing ? <Square size={16} /> : <Play size={16} />}
            {playLoading ? "Loading" : playing ? "Stop" : "Play"}
          </Button>
        </div>
        <AuthControls />
      </header>
      <div
        className="jam-workbench-main"
        ref={mainPane}
        style={
          {
            "--jam-files-width": `${filesWidth}px`,
            "--jam-inspector-width": `${inspectorWidth}px`,
            ...Object.fromEntries(
              mixTracks.map((item) => [
                `--jam-track-${item.orbit}`,
                `var(--track-${mixColors[String(item.orbit)] ?? ((item.orbit - 64) % 6) + 1})`,
              ]),
            ),
          } as React.CSSProperties
        }
      >
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
            <SlidersVertical size={20} aria-hidden="true" />
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
        {sidebarOpen && (
          <div
            className="jam-pane-resizer"
            role="separator"
            tabIndex={0}
            aria-label="Resize Files pane"
            aria-orientation="vertical"
            aria-valuemin={PANE_LIMITS.files.min}
            aria-valuemax={paneMaximum("files")}
            aria-valuenow={filesWidth}
            onPointerDown={(event) => onPanePointerDown("files", event)}
            onPointerMove={onPanePointerMove}
            onPointerUp={onPanePointerEnd}
            onPointerCancel={onPanePointerEnd}
            onKeyDown={(event) => onPaneKeyDown("files", event)}
          />
        )}
        <div
          className="jam-editor-column"
          ref={editorColumn}
          style={{ "--jam-output-height": `${outputHeight}px` } as React.CSSProperties}
        >
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
              resizeHandle={{
                min: OUTPUT_LIMITS.min,
                max: outputMaximum(),
                now: Math.min(outputHeight, outputMaximum()),
                onPointerDown: onOutputPointerDown,
                onPointerMove: onOutputPointerMove,
                onPointerEnd: onOutputPointerEnd,
                onKeyDown: onOutputKeyDown,
              }}
              onDismiss={() => {
                setPlayError(null);
                setError(null);
              }}
            />
          )}
        </div>
        {inspectorOpen && (
          <div
            className="jam-pane-resizer"
            role="separator"
            tabIndex={0}
            aria-label="Resize Inspector pane"
            aria-orientation="vertical"
            aria-valuemin={PANE_LIMITS.inspector.min}
            aria-valuemax={paneMaximum("inspector")}
            aria-valuenow={inspectorWidth}
            onPointerDown={(event) => onPanePointerDown("inspector", event)}
            onPointerMove={onPanePointerMove}
            onPointerUp={onPanePointerEnd}
            onPointerCancel={onPanePointerEnd}
            onKeyDown={(event) => onPaneKeyDown("inspector", event)}
          />
        )}
        {inspectorOpen && (
          <TrackInspector
            track={track}
            tracks={model.tracks}
            valid={model.valid}
            view={activeView}
            onSelectTrack={setSelectedTrack}
            mixTracks={mixTracks}
            mixLevels={mixLevels}
            masterLevel={masterLevel}
            soloTrack={soloTrack}
            onMixLevel={(id, value) =>
              !exportingNow.current && changeMix(masterLevel, { ...mixLevels, [id]: value })
            }
            onMasterLevel={(value) => !exportingNow.current && changeMix(value, mixLevels)}
            onSoloTrack={(id) => {
              if (!exportingNow.current) setSoloTrack(id);
            }}
            mixColors={mixColors}
            onTrackColor={changeTrackColor}
            onRenameTrack={renameTrack}
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
