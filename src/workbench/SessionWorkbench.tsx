import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isolateHistory } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import {
  AlertCircle,
  Bot,
  ChevronLeft,
  FileCode2,
  Folder,
  FolderPlus,
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Search,
  Command,
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
import type { FrameSource, MeterFrame, VisualFrame } from "@/lib/types";
import { clearPlaybackRanges, flashPlaybackRanges } from "@/components/jam/playback-highlights";
import {
  browserStorage,
  type DocumentRecord,
  type WorkspaceRecord,
  type WorkspaceStorage,
} from "@/workspaces/storage";
import { TrackInspector } from "./TrackInspector";
import { OutputPanel } from "./OutputPanel";
import { AuthControls } from "@/workbench/AuthControls";
import {
  ShareControls,
  SharedProjectList,
  SharedSession,
} from "@/features/collaboration/ShareControls";
import { ExportControl } from "./ExportControl";
import { AgentProposalControl } from "@/features/assistant/AgentProposalControl";
import { applyReviewedProposal } from "@/features/assistant/apply-proposal";
import type { ChangeProposal } from "@/features/assistant/proposal";
import { GitPanel } from "./GitPanel";
import { CommandPalette, type WorkbenchCommand } from "./CommandPalette";
import { syntaxProblems } from "@/features/language/syntax-problems";
import {
  captureTake,
  deleteDocumentTakes,
  listTakes,
  type TakeRecord,
} from "@/features/takes/take-store";
import { EditorView as CodeMirrorView } from "@codemirror/view";

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

export function SessionWorkbench({
  workspaceId,
  initialDocumentId,
  onWorkspaceRoute,
  onAppRoute,
  onDocumentRoute,
  storage = browserStorage,
  collaboration = false,
  sharedOnly = false,
}: {
  workspaceId?: string;
  initialDocumentId?: string | undefined;
  onWorkspaceRoute?: (id: string | null) => void;
  onAppRoute?: (route: "/app/help" | "/app/library") => void;
  onDocumentRoute?: (id: string | null) => void;
  storage?: WorkspaceStorage;
  collaboration?: boolean;
  sharedOnly?: boolean;
} = {}) {
  const {
    createDocument,
    createWorkspace,
    deleteDocument,
    deleteWorkspace,
    listDocuments,
    listWorkspaces,
    renameDocument,
    renameWorkspace,
    saveDocument,
  } = storage;
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
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches,
  );
  const [inspectorOpen, setInspectorOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches,
  );
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [agentAvailable, setAgentAvailable] = useState(false);
  const [outputOpen, setOutputOpen] = useState(true);
  const [paletteMode, setPaletteMode] = useState<"files" | "commands" | null>(null);
  const [outputHeight, setOutputHeight] = useState(storedOutputHeight);
  const [filesWidth, setFilesWidth] = useState(() => storedPaneWidth("files", 232));
  const [inspectorWidth, setInspectorWidth] = useState(() => storedPaneWidth("inspector", 256));
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [diskConflicts, setDiskConflicts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [soloTrack, setSoloTrack] = useState<string | null>(null);
  const [mutedTracks, setMutedTracks] = useState(() => new Set<string>());
  const [playLoading, setPlayLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [audioOutput, setAudioOutput] = useState<{ context: AudioContext; node: AudioNode } | null>(
    null,
  );
  const [outputFrames, setOutputFrames] = useState<{
    meter: FrameSource<MeterFrame>;
    visual: FrameSource<VisualFrame>;
  } | null>(null);
  const [collabStatus, setCollabStatus] = useState("offline");
  const [presence, setPresence] = useState<{ id: string; name: string }[]>([]);
  const collabStatusByDocument = useRef(new Map<string, string>());
  const presenceByDocument = useRef(new Map<string, { id: string; name: string }[]>());
  const [takes, setTakes] = useState<TakeRecord[]>([]);
  const [auditionTakeId, setAuditionTakeId] = useState<string | null>(null);
  const [tempo, setTempo] = useState(() => readTempo(""));
  const [, setReadyVersion] = useState(0);
  const views = useRef(new Map<string, EditorView>());
  const paletteReturnFocus = useRef<HTMLElement | null>(null);
  const mainPane = useRef<HTMLDivElement>(null);
  const editorColumn = useRef<HTMLDivElement>(null);
  const paneDrag = useRef<{ side: PaneSide; startX: number; startWidth: number } | null>(null);
  const outputDrag = useRef<{ startY: number; startHeight: number } | null>(null);
  const drafts = useRef(new Map<string, DocumentRecord>());
  const documentsRef = useRef(documents);
  documentsRef.current = documents;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const activeIdRef = useRef<string | null>(null);
  const initialDocumentIdRef = useRef(initialDocumentId);
  const code = useRef("");
  const playingNow = useRef(false);
  const loadingNow = useRef(false);
  const mounted = useRef(true);
  const evaluation = useRef(0);
  const pendingEvaluation = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportAbort = useRef<AbortController | null>(null);
  const exportingNow = useRef(false);

  const activeDocument = documents.find((item) => item.id === activeId) ?? null;
  const agentRole = activeDocument?.shared?.role;
  useEffect(() => {
    if (!collaboration || !agentRole || agentRole === "viewer") {
      setAgentAvailable(false);
      setAssistantOpen(false);
      return;
    }
    let current = true;
    void fetch("/api/agent-proposal")
      .then(async (response) =>
        response.ok ? (response.json() as Promise<{ available: boolean }>) : { available: false },
      )
      .then((result) => {
        if (current) setAgentAvailable(result.available);
      })
      .catch(() => {
        if (current) setAgentAvailable(false);
      });
    return () => {
      current = false;
    };
  }, [collaboration, agentRole]);
  const nativeWorkspace = !!workspace && !!storage.isNativeWorkspace?.(workspace.id);
  const diskDirty = !!activeDocument && !!storage.isDirty?.(activeDocument);
  const beatsPerCycle = activeDocument?.beatsPerCycle ?? 4;
  const model = useMemo(() => deriveMusic(activeDocument?.source ?? ""), [activeDocument?.source]);
  const problems = useMemo(
    () => syntaxProblems(activeDocument?.source ?? ""),
    [activeDocument?.source],
  );
  const mixTracks = useMemo(() => {
    const mix = prepareMix(activeDocument?.source ?? "");
    return mix.mixable === false ? [] : mix.tracks;
  }, [activeDocument?.source]);
  const mixLevels = activeDocument?.mix?.levels ?? EMPTY_LEVELS;
  const mixColors = activeDocument?.mix?.colors ?? EMPTY_LEVELS;
  const masterLevel = activeDocument?.mix?.master ?? 1;
  const track =
    model.tracks.find((item) => item.name === selectedTrack) ??
    model.tracks.find((item) => item.lenses.some((lens) => lens.kind === "param")) ??
    model.tracks[0] ??
    null;
  const editableCount = model.tracks.reduce(
    (total, item) =>
      total + item.lenses.filter((lens) => lens.kind === "param" || !lens.locked).length,
    0,
  );

  useEffect(() => {
    let current = true;
    setLoadingWorkspaces(true);
    setWorkspace(null);
    setDocuments([]);
    setOpenIds([]);
    setActiveId(null);
    setError(null);
    void listWorkspaces()
      .then(async (items) => {
        if (!current) return;
        setWorkspaces(items);
        if (!workspaceId) return;
        const next = items.find((item) => item.id === workspaceId);
        if (!next) {
          setError("This workspace was not found in this browser.");
          return;
        }
        const documents = await listDocuments(next.id);
        if (!current) return;
        setWorkspace(next);
        setDocuments(documents);
        drafts.current = new Map(documents.map((item) => [item.id, item]));
        const initialDocument =
          documents.find((item) => item.id === initialDocumentIdRef.current) ?? documents[0];
        setOpenIds(initialDocument ? [initialDocument.id] : []);
        setActiveId(initialDocument?.id ?? null);
        setSelectedTrack(null);
        document.title = `${next.name} | JamScript`;
      })
      .catch((cause: unknown) => {
        if (current) setError(message(cause));
      })
      .finally(() => {
        if (current) setLoadingWorkspaces(false);
      });
    return () => {
      current = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    const evaluationCounter = evaluation;
    const saveTimers = timers;
    const editorViews = views.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      evaluationCounter.current++;
      if (pendingEvaluation.current) clearTimeout(pendingEvaluation.current);
      exportAbort.current?.abort();
      for (const timer of saveTimers.current.values()) clearTimeout(timer);
      for (const document of drafts.current.values()) void saveDocument(document);
      for (const view of editorViews.values()) clearPlaybackRanges(view);
      void import("@/engine/playback").then((pb) => {
        pb.onError(null);
        pb.onHighlight(null);
        void pb.stop();
      });
    };
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
    setSaveStatus("saved");
    setTakes([]);
    setAuditionTakeId(null);
    if (activeId) {
      requestAnimationFrame(() => views.current.get(activeId)?.requestMeasure());
      let current = true;
      void listTakes(activeId)
        .then((items) => {
          if (current) setTakes(items);
        })
        .catch((cause: unknown) => {
          if (current) setError(`Could not load Takes: ${message(cause)}`);
        });
      return () => {
        current = false;
      };
    }
    return undefined;
  }, [activeId]);

  useEffect(() => {
    code.current = activeDocument?.source ?? "";
    setTempo(readTempo(code.current));
  }, [activeDocument?.source]);

  useEffect(() => {
    const activeSolo = mixTracks.some((item) => item.id === soloTrack) ? soloTrack : null;
    const activeMuted = [...mutedTracks].filter((id) => mixTracks.some((item) => item.id === id));
    if (!exportingNow.current)
      void import("@/engine/playback").then((playback) =>
        playback.setMix(mixLevels, activeSolo, masterLevel, activeMuted),
      );
  }, [mixLevels, masterLevel, soloTrack, mutedTracks, mixTracks]);

  useEffect(() => {
    if (soloTrack && !mixTracks.some((item) => item.id === soloTrack)) setSoloTrack(null);
    setMutedTracks((current) => {
      const next = new Set([...current].filter((id) => mixTracks.some((item) => item.id === id)));
      return next.size === current.size && [...next].every((id) => current.has(id))
        ? current
        : next;
    });
  }, [mixTracks, soloTrack]);

  useEffect(() => {
    const fitDrawers = () => {
      if (window.innerWidth < 900 && sidebarOpen && (inspectorOpen || assistantOpen)) {
        setInspectorOpen(false);
        setAssistantOpen(false);
      }
    };
    fitDrawers();
    window.addEventListener("resize", fitDrawers);
    return () => window.removeEventListener("resize", fitDrawers);
  }, [sidebarOpen, inspectorOpen, assistantOpen]);

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
    if (!view || !view.state.facet(CodeMirrorView.editable)) return false;
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
      onWorkspaceRoute?.(next.id);
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

  const openNativeFolder = async () => {
    if (!storage.openFolder) return;
    try {
      setError(null);
      const next = await storage.openFolder();
      if (!next) return;
      setWorkspaces(await listWorkspaces());
      await openWorkspace(next);
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

  const evaluateCurrent = useCallback(
    async (take?: TakeRecord) => {
      const request = ++evaluation.current;
      loadingNow.current = true;
      setPlayLoading(true);
      try {
        const playback = await import("@/engine/playback");
        if (!mounted.current || request !== evaluation.current) return;
        let reportedError: string | null = null;
        playback.onError((detail) => {
          reportedError = detail;
          if (mounted.current && request === evaluation.current) setPlayError(detail);
        });
        playback.onAsset?.((detail) => {
          if (mounted.current && request === evaluation.current) setPlayError(detail);
        });
        const documentId = activeIdRef.current;
        const evaluatedSource = take?.source ?? code.current;
        const view = documentId ? views.current.get(documentId) : null;
        if (view) clearPlaybackRanges(view);
        playback.onHighlight((ranges) => {
          if (exportingNow.current || activeIdRef.current !== documentId) return;
          const currentView = documentId ? views.current.get(documentId) : null;
          if (currentView?.state.doc.toString() === evaluatedSource)
            flashPlaybackRanges(currentView, ranges);
        });
        const current = drafts.current.get(activeIdRef.current ?? "");
        playback.setMix(current?.mix?.levels ?? {}, soloTrack, current?.mix?.master ?? 1, [
          ...mutedTracks,
        ]);
        const ok = await playback.play(evaluatedSource);
        if (!mounted.current || request !== evaluation.current) return;
        if (ok) {
          playingNow.current = true;
          setPlaying(true);
          setAuditionTakeId(take?.id ?? null);
          setPlayError(null);
          if (!take && documentId && evaluatedSource.trim()) {
            void captureTake(documentId, evaluatedSource)
              .then((items) => {
                if (mounted.current && activeIdRef.current === documentId) setTakes(items);
              })
              .catch((cause: unknown) => {
                if (mounted.current) setError(`Could not save Take: ${message(cause)}`);
              });
          }
          setAudioOutput(playback.getOutputNode());
          const frames = (
            playback as {
              outputFrames?: () => {
                meter: FrameSource<MeterFrame>;
                visual: FrameSource<VisualFrame>;
              };
            }
          ).outputFrames?.();
          setOutputFrames(frames ?? null);
        } else {
          playingNow.current = false;
          setPlaying(false);
          setAudioOutput(null);
          setOutputFrames(null);
          setPlayError(reportedError ?? "Could not evaluate the current document.");
        }
      } catch (cause) {
        if (mounted.current && request === evaluation.current) {
          playingNow.current = false;
          setPlaying(false);
          setAudioOutput(null);
          setOutputFrames(null);
          setPlayError(message(cause));
          void import("@/engine/playback").then((playback) => playback.stop());
        }
      } finally {
        if (mounted.current && request === evaluation.current) {
          loadingNow.current = false;
          setPlayLoading(false);
        }
      }
    },
    [soloTrack, mutedTracks],
  );

  const stopPlayback = useCallback(async () => {
    playingNow.current = false;
    loadingNow.current = false;
    evaluation.current++;
    if (pendingEvaluation.current) clearTimeout(pendingEvaluation.current);
    setPlaying(false);
    setPlayLoading(false);
    setAuditionTakeId(null);
    setAudioOutput(null);
    setOutputFrames(null);
    for (const view of views.current.values()) clearPlaybackRanges(view);
    const pb = await import("@/engine/playback");
    pb.onHighlight(null);
    await pb.stop();
  }, []);

  useEffect(() => {
    if (!initialDocumentId || !documentsRef.current.some((item) => item.id === initialDocumentId))
      return;
    if (activeIdRef.current !== initialDocumentId && (playingNow.current || loadingNow.current))
      void stopPlayback();
    setOpenIds((ids) => (ids.includes(initialDocumentId) ? ids : [...ids, initialDocumentId]));
    setActiveId(initialDocumentId);
    setSelectedTrack(null);
  }, [initialDocumentId, stopPlayback]);

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
      setMutedTracks((current) => {
        const next = new Set<string>();
        for (const id of current) next.add(renamed.get(id) ?? id);
        return next;
      });
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
    if (playingNow.current || loadingNow.current) void stopPlayback();
    setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setActiveId(id);
    if (collaboration) {
      setCollabStatus(collabStatusByDocument.current.get(id) ?? "connecting");
      setPresence(presenceByDocument.current.get(id) ?? []);
    }
    onDocumentRoute?.(id);
    setSelectedTrack(null);
    setSoloTrack(null);
    setMutedTracks(new Set());
  };

  const closeTab = (id: string) => {
    const item = drafts.current.get(id);
    if (
      item &&
      storage.isDirty?.(item) &&
      !confirm(
        `Close ${item.name} with unsaved disk changes? The recovery copy will remain available when you reopen it.`,
      )
    )
      return;
    if (activeId === id) {
      if (playingNow.current || loadingNow.current) void stopPlayback();
      setSelectedTrack(null);
      setSoloTrack(null);
      setMutedTracks(new Set());
      const nextId = openIds.find((open) => open !== id) ?? null;
      setActiveId(nextId);
      onDocumentRoute?.(nextId);
    }
    setOpenIds((ids) => ids.filter((open) => open !== id));
  };

  const openPalette = useCallback(
    (mode: "files" | "commands") => {
      if (!paletteMode) paletteReturnFocus.current = document.activeElement as HTMLElement | null;
      setPaletteMode(mode);
    },
    [paletteMode],
  );
  const closePalette = (restoreFocus = true) => {
    setPaletteMode(null);
    if (restoreFocus) requestAnimationFrame(() => paletteReturnFocus.current?.focus());
  };

  useEffect(() => {
    if (!workspace) return;
    const onShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "p"
      )
        return;
      event.preventDefault();
      openPalette(event.shiftKey ? "commands" : "files");
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [workspace, openPalette]);

  const exportMain = async (format: "wav" | "mp3", bars: number) => {
    if (!activeDocument || exportingNow.current) return;
    const abort = new AbortController();
    exportAbort.current = abort;
    exportingNow.current = true;
    setExporting(true);
    setExportProgress(0);
    setPlayError(null);
    try {
      if (playingNow.current || loadingNow.current) await stopPlayback();
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
      setOutputFrames(null);
      const latest = drafts.current.get(activeIdRef.current ?? "");
      void import("@/engine/playback").then((pb) =>
        pb.setMix(
          latest?.mix?.levels ?? EMPTY_LEVELS,
          activeIdRef.current === activeDocument.id ? soloTrack : null,
          latest?.mix?.master ?? 1,
          activeIdRef.current === activeDocument.id ? [...mutedTracks] : [],
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
    const dirty = nativeWorkspace && storage.isDirty?.(item);
    const deletionEffect = nativeWorkspace
      ? `This removes the file from disk.${dirty ? " Unsaved edits and the recovery copy will be lost." : ""}`
      : "This removes it from this browser.";
    if (!confirm(`Delete ${item.name}? ${deletionEffect}`)) return;
    try {
      const timer = timers.current.get(item.id);
      if (timer) clearTimeout(timer);
      timers.current.delete(item.id);
      await deleteDocument(item.id);
      drafts.current.delete(item.id);
      setDocuments((items) => items.filter((doc) => doc.id !== item.id));
      setOpenIds((ids) => ids.filter((id) => id !== item.id));
      if (activeId === item.id) {
        if (playingNow.current || loadingNow.current) void stopPlayback();
        const next = documents.find((doc) => doc.id !== item.id);
        setActiveId(next?.id ?? null);
        if (next) setOpenIds((ids) => (ids.includes(next.id) ? ids : [...ids, next.id]));
      }
      void deleteDocumentTakes(item.id).catch((cause: unknown) =>
        setError(`Could not clear Takes for ${item.name}: ${message(cause)}`),
      );
    } catch (cause) {
      setError(message(cause));
    }
  };

  const leaveWorkspace = () => {
    if (
      nativeWorkspace &&
      [...drafts.current.values()].some((item) => storage.isDirty?.(item)) &&
      !confirm(
        "Leave this folder with unsaved disk changes? Recovery copies will remain available.",
      )
    )
      return;
    if (playingNow.current || loadingNow.current) void stopPlayback();
    setWorkspace(null);
    setDocuments([]);
    setOpenIds([]);
    setActiveId(null);
    document.title = "JamScript | Workspaces";
    onWorkspaceRoute?.(null);
    void listWorkspaces()
      .then(setWorkspaces)
      .catch((cause: unknown) => setError(message(cause)));
  };

  const saveActiveToDisk = useCallback(async () => {
    if (!storage.saveToDisk || !activeIdRef.current) return;
    const item = drafts.current.get(activeIdRef.current);
    if (!item || !storage.isNativeWorkspace?.(item.workspaceId)) return;
    try {
      setSaveStatus("saving");
      await storage.saveToDisk(item);
      setSaveStatus("saved");
      setError(null);
    } catch (cause) {
      setSaveStatus("error");
      setError(`Could not save ${item.name}: ${message(cause)}`);
    }
  }, [storage]);

  useEffect(() => {
    if (!storage.saveToDisk) return;
    const onSave = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveActiveToDisk();
    };
    window.addEventListener("keydown", onSave);
    return () => window.removeEventListener("keydown", onSave);
  }, [saveActiveToDisk, storage]);

  const applyExternalSource = (item: DocumentRecord, source: string) => {
    const view = views.current.get(item.id);
    if (view) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
      return;
    }
    const next = { ...(drafts.current.get(item.id) ?? item), source };
    drafts.current.set(item.id, next);
    setDocuments((current) => current.map((doc) => (doc.id === item.id ? next : doc)));
  };

  const refreshOpenDocuments = useCallback(async () => {
    if (!storage.refreshDocument) return;
    for (const item of documentsRef.current) {
      const current = drafts.current.get(item.id) ?? item;
      try {
        const result = await storage.refreshDocument(current);
        if (result.conflict) {
          setDiskConflicts((existing) =>
            existing[item.id] === result.conflict!.diskSource
              ? existing
              : { ...existing, [item.id]: result.conflict!.diskSource },
          );
          continue;
        }
        setDiskConflicts((existing) => {
          if (!existing[item.id]) return existing;
          const next = { ...existing };
          delete next[item.id];
          return next;
        });
        if (result.changed) applyExternalSource(current, result.source);
      } catch (cause) {
        setError(message(cause));
      }
    }
  }, [storage]);

  const reloadNativeFiles = async () => {
    if (!workspace) return;
    await refreshOpenDocuments();
    const diskFiles = await listDocuments(workspace.id);
    const ids = new Set(diskFiles.map((item) => item.id));
    for (const item of diskFiles)
      if (!drafts.current.has(item.id)) drafts.current.set(item.id, item);
    for (const id of drafts.current.keys()) if (!ids.has(id)) drafts.current.delete(id);
    setDocuments((current) => [
      ...current.filter((item) => ids.has(item.id)),
      ...diskFiles.filter((item) => !current.some((existing) => existing.id === item.id)),
    ]);
    setOpenIds((current) => current.filter((id) => ids.has(id)));
    if (!activeIdRef.current || !ids.has(activeIdRef.current)) {
      const first = diskFiles[0]?.id ?? null;
      setOpenIds(first ? [first] : []);
      setActiveId(first);
    }
  };

  useEffect(() => {
    if (!nativeWorkspace || !workspace) return;
    let stop = false;
    let unsubscribe = () => {};
    void storage
      .watchWorkspace?.(workspace.id, () => {
        if (!stop) void refreshOpenDocuments();
      })
      .then((remove) => {
        if (stop) remove();
        else unsubscribe = remove;
      });
    const timer = window.setInterval(() => void refreshOpenDocuments(), 8000);
    return () => {
      stop = true;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [nativeWorkspace, refreshOpenDocuments, storage, workspace]);

  useEffect(() => {
    if (!nativeWorkspace) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      if (![...drafts.current.values()].some((item) => storage.isDirty?.(item))) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [nativeWorkspace, storage]);

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
  const changeBeatsPerCycle = (value: number) => {
    if (activeDocument?.shared?.role === "viewer") return;
    if (!activeId || !Number.isInteger(value) || value < 1 || value > 16) return;
    const current = drafts.current.get(activeId);
    if (!current) return;
    const next = { ...current, beatsPerCycle: value };
    setDocuments((items) => items.map((item) => (item.id === activeId ? next : item)));
    scheduleSave(next);
  };

  const commands: WorkbenchCommand[] = [
    ...documents.map((item) => ({
      id: `file-${item.id}`,
      label: item.name,
      group: "Files" as const,
      run: () => {
        selectDocument(item.id);
        requestAnimationFrame(() => views.current.get(item.id)?.focus());
      },
    })),
    {
      id: "play",
      label: "Play current document",
      group: "Commands",
      keywords: "transport evaluate",
      run: () => {
        if (activeDocument) void evaluateCurrent();
      },
    },
    {
      id: "stop",
      label: "Stop playback",
      group: "Commands",
      keywords: "transport hush",
      run: () => void stopPlayback(),
    },
    ...(nativeWorkspace
      ? [
          {
            id: "save",
            label: "Save current document to disk",
            group: "Commands" as const,
            keywords: "file save",
            run: () => void saveActiveToDisk(),
          },
        ]
      : []),
    {
      id: "files",
      label: sidebarOpen ? "Hide Files" : "Show Files",
      group: "Commands",
      run: () => {
        setSidebarOpen(!sidebarOpen);
        if (!sidebarOpen && window.innerWidth < 900) {
          setInspectorOpen(false);
          setAssistantOpen(false);
        }
      },
    },
    {
      id: "inspector",
      label: inspectorOpen ? "Hide Inspector" : "Show Inspector",
      group: "Commands",
      run: () => {
        setInspectorOpen(!inspectorOpen);
        if (!inspectorOpen) {
          setAssistantOpen(false);
          if (window.innerWidth < 900) setSidebarOpen(false);
        }
      },
    },
    ...(agentAvailable
      ? [
          {
            id: "assistant",
            label: assistantOpen ? "Hide Assistant" : "Show Assistant",
            group: "Commands" as const,
            run: () => {
              setAssistantOpen(!assistantOpen);
              if (!assistantOpen) {
                setInspectorOpen(false);
                if (window.innerWidth < 900) setSidebarOpen(false);
              }
            },
          },
        ]
      : []),
    {
      id: "output",
      label: outputOpen ? "Hide Output" : "Show Output",
      group: "Commands",
      run: () => setOutputOpen(!outputOpen),
    },
    ...(!sharedOnly
      ? [
          {
            id: "new-document",
            label: "New document",
            group: "Commands" as const,
            keywords: "file create",
            run: () => {
              setSidebarOpen(true);
              if (window.innerWidth < 900) {
                setInspectorOpen(false);
                setAssistantOpen(false);
              }
              requestAnimationFrame(() => document.getElementById("new-document-name")?.focus());
            },
          },
        ]
      : []),
  ];

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
              <>
                <a
                  href="/app/library"
                  onClick={(event) => {
                    if (onAppRoute) {
                      event.preventDefault();
                      onAppRoute("/app/library");
                    }
                  }}
                >
                  Library
                </a>
                <a
                  href="/app/help"
                  onClick={(event) => {
                    if (onAppRoute) {
                      event.preventDefault();
                      onAppRoute("/app/help");
                    }
                  }}
                >
                  Help
                </a>
                <a href="/">
                  Website <ArrowUpRight size={14} />
                </a>
              </>
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
            {storage.openFolder && (
              <Button type="button" variant="outline" onClick={() => void openNativeFolder()}>
                <Folder size={16} /> Open folder from disk
              </Button>
            )}
            {collaboration && <SharedProjectList />}
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
                          <div className="jam-inline-form-actions">
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
                          </div>
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
                          {!storage.isNativeWorkspace?.(item.id) && (
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
                          )}
                          {!storage.isNativeWorkspace?.(item.id) && (
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
                                  const removedDocuments = await listDocuments(item.id);
                                  await deleteWorkspace(item.id);
                                  setWorkspaces(await listWorkspaces());
                                  void Promise.all(
                                    removedDocuments.map((doc) => deleteDocumentTakes(doc.id)),
                                  ).catch((cause: unknown) =>
                                    setError(`Could not clear old Takes: ${message(cause)}`),
                                  );
                                } catch (cause) {
                                  setError(message(cause));
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
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
      {paletteMode && (
        <CommandPalette
          key={paletteMode}
          mode={paletteMode}
          commands={commands}
          onClose={closePalette}
        />
      )}
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
            key={`${activeId}-${beatsPerCycle}`}
            cps={tempo.cps}
            beatsPerCycle={beatsPerCycle}
            editable={
              !!activeDocument &&
              activeDocument.shared?.role !== "viewer" &&
              tempo.editable &&
              !exporting
            }
            onCpsChange={onTempoChange}
          />
          <details className="jam-tempo-advanced">
            <summary aria-label="Advanced tempo settings">Tempo settings</summary>
            <label>
              Beats per cycle
              <select
                aria-label="Beats per cycle"
                value={beatsPerCycle}
                disabled={!activeDocument || activeDocument.shared?.role === "viewer"}
                onChange={(event) => changeBeatsPerCycle(Number(event.target.value))}
              >
                {Array.from({ length: 16 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <output aria-label="Cycles per second">
              {tempo.cps === null ? "CPS from code" : `${Number(tempo.cps.toPrecision(8))} CPS`}
            </output>
          </details>
          <ExportControl
            disabled={
              import.meta.env.MODE === "desktop" ||
              !activeDocument ||
              tempo.cps === null ||
              !tempo.editable
            }
            exporting={exporting}
            progress={exportProgress}
            onExport={(format, bars) => void exportMain(format, bars)}
            onCancel={() => exportAbort.current?.abort()}
          />
          <Button
            className="jam-play"
            size="sm"
            variant={playing || playLoading ? "default" : "outline"}
            disabled={(!activeDocument && !playing && !playLoading) || exporting}
            onClick={() => void (playing || playLoading ? stopPlayback() : evaluateCurrent())}
          >
            {playing || playLoading ? <Square size={16} /> : <Play size={16} />}
            {playing || playLoading ? "Stop" : "Play"}
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Stop all audio"
            title="Stop all audio"
            onClick={() => void stopPlayback()}
          >
            <Square size={14} />
          </Button>
          {collaboration && (
            <ShareControls
              document={activeDocument}
              documents={documents}
              workspaceName={workspace?.name ?? "Workspace"}
              onShared={(shared) => {
                const byId = new Map(shared.map((item) => [item.id, item]));
                for (const item of shared) {
                  drafts.current.set(item.id, item);
                  void saveDocument(item);
                }
                setDocuments((items) => items.map((item) => byId.get(item.id) ?? item));
              }}
            />
          )}
          {nativeWorkspace && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void saveActiveToDisk()}
              disabled={!activeDocument || !diskDirty}
            >
              Save
            </Button>
          )}
          {nativeWorkspace && storage.saveAs && (
            <Button
              size="sm"
              variant="ghost"
              disabled={!activeDocument}
              onClick={async () => {
                if (!activeDocument) return;
                const name = prompt("Save a copy as", activeDocument.name);
                if (!name || name === activeDocument.name) return;
                try {
                  const copy = await storage.saveAs!(
                    drafts.current.get(activeDocument.id) ?? activeDocument,
                    name,
                  );
                  drafts.current.set(copy.id, copy);
                  setDocuments((items) => [...items, copy]);
                  selectDocument(copy.id);
                } catch (cause) {
                  setError(message(cause));
                }
              }}
            >
              Save As
            </Button>
          )}
        </div>
        <AuthControls />
      </header>
      {nativeWorkspace && activeDocument && diskConflicts[activeDocument.id] && (
        <div className="jam-conflict" role="alert">
          <span>{activeDocument.name} changed on disk. Your unsaved edits are still here.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const current = drafts.current.get(activeDocument.id);
              if (!current || !storage.acceptDisk) return;
              void storage
                .acceptDisk(current)
                .then((next) => {
                  drafts.current.set(next.id, next);
                  applyExternalSource(next, next.source);
                  setDiskConflicts((existing) => {
                    const copy = { ...existing };
                    delete copy[next.id];
                    return copy;
                  });
                  setError(null);
                })
                .catch((cause: unknown) => setError(message(cause)));
            }}
          >
            Load disk
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const current = drafts.current.get(activeDocument.id);
              if (!current || !storage.keepLocalOverDisk) return;
              void storage
                .keepLocalOverDisk(current)
                .then(() => {
                  setDiskConflicts((existing) => {
                    const copy = { ...existing };
                    delete copy[current.id];
                    return copy;
                  });
                  setError(null);
                })
                .catch((cause: unknown) => setError(message(cause)));
            }}
          >
            Keep mine
          </Button>
          <details className="jam-conflict-compare">
            <summary>Compare changes</summary>
            <div className="jam-take-compare">
              <div>
                <strong>Unsaved editor</strong>
                <pre>{activeDocument.source}</pre>
              </div>
              <div>
                <strong>Changed on disk</strong>
                <pre>{diskConflicts[activeDocument.id]}</pre>
              </div>
            </div>
          </details>
        </div>
      )}
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
            onClick={() => openPalette("files")}
            aria-label="Quick Open"
            title="Quick Open (Ctrl/Cmd+P)"
          >
            <Search size={20} aria-hidden="true" />
          </button>
          <button
            onClick={() => openPalette("commands")}
            aria-label="Command palette"
            title="Command palette (Ctrl/Cmd+Shift+P)"
          >
            <Command size={20} aria-hidden="true" />
          </button>
          <button
            className={sidebarOpen ? "is-active" : ""}
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              if (!sidebarOpen && window.innerWidth < 900) {
                setInspectorOpen(false);
                setAssistantOpen(false);
              }
            }}
            aria-label={sidebarOpen ? "Hide files" : "Show files"}
          >
            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
          <button
            className={inspectorOpen ? "is-active" : ""}
            onClick={() => {
              setInspectorOpen(!inspectorOpen);
              if (!inspectorOpen) {
                setAssistantOpen(false);
                if (window.innerWidth < 900) setSidebarOpen(false);
              }
            }}
            aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
          >
            <SlidersVertical size={20} aria-hidden="true" />
          </button>
          {agentAvailable && (
            <button
              className={assistantOpen ? "is-active" : ""}
              onClick={() => {
                setAssistantOpen(!assistantOpen);
                if (!assistantOpen) {
                  setInspectorOpen(false);
                  if (window.innerWidth < 900) setSidebarOpen(false);
                }
              }}
              aria-label={assistantOpen ? "Hide assistant" : "Show assistant"}
            >
              <Bot size={20} aria-hidden="true" />
            </button>
          )}
        </nav>
        {sidebarOpen && (
          <aside className="jam-file-sidebar">
            <div className="jam-panel-heading">
              <span>FILES</span>
              {!sharedOnly && (
                <button
                  onClick={() => document.getElementById("new-document-name")?.focus()}
                  aria-label="New document"
                >
                  <Plus size={17} />
                </button>
              )}
            </div>
            <div className="jam-sidebar-workspace">
              <Folder size={15} />
              {workspace.name}
            </div>
            {!sharedOnly && (
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
            )}
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
                      <div className="jam-inline-form-actions">
                        <button type="submit">Save</button>
                        <button type="button" onClick={() => setRenaming(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        className={`jam-file-button ${item.id === activeId ? "is-active" : ""}`}
                        onClick={() => selectDocument(item.id)}
                      >
                        <FileCode2 size={15} />
                        <span>
                          {item.name}
                          {storage.isDirty?.(item) ? " •" : ""}
                        </span>
                      </button>
                      {(!sharedOnly || (item.shared && item.shared.role !== "viewer")) && (
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
                      )}
                      {!sharedOnly && (
                        <button
                          className="jam-file-action"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => void removeDocument(item)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {nativeWorkspace && storage.git && (
              <GitPanel
                workspaceId={workspace.id}
                documents={documents}
                git={storage.git}
                isDirty={(document) => !!storage.isDirty?.(document)}
                onFilesChanged={() =>
                  void reloadNativeFiles().catch((cause: unknown) => setError(message(cause)))
                }
              />
            )}
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
                      {storage.isDirty?.(item) ? " •" : ""}
                    </button>
                    <button
                      className="jam-tab-close"
                      aria-label={`Close ${item.name} tab`}
                      onClick={() => closeTab(id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              );
            })}
          </div>
          {collaboration &&
            openIds.map((id) => {
              const document = documents.find((item) => item.id === id);
              const view = views.current.get(id);
              return document?.shared && view ? (
                <SharedSession
                  key={id}
                  view={view}
                  document={document}
                  onStatus={(status) => {
                    collabStatusByDocument.current.set(id, status);
                    if (activeIdRef.current === id) setCollabStatus(status);
                  }}
                  onPresence={(people) => {
                    presenceByDocument.current.set(id, people);
                    if (activeIdRef.current === id) setPresence(people);
                  }}
                />
              ) : null;
            })}
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
                            if (typeof Worker !== "undefined")
                              void import("@/features/language/client")
                                .then(({ attachStrudelLanguage }) =>
                                  attachStrudelLanguage(view, id),
                                )
                                .catch((cause: unknown) =>
                                  setError(`IntelliSense unavailable: ${message(cause)}`),
                                );
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
              problems={problems}
              onSelectProblem={(problem) => {
                const view = views.current.get(activeIdRef.current ?? "");
                if (!view) return;
                view.dispatch({
                  selection: { anchor: problem.from, head: problem.to },
                  effects: CodeMirrorView.scrollIntoView(problem.from, { y: "center" }),
                });
                view.focus();
              }}
              takes={takes}
              liveSource={activeDocument?.source ?? ""}
              auditionTakeId={auditionTakeId}
              onAuditionTake={(take) => void evaluateCurrent(take)}
              onReturnToLive={() => void evaluateCurrent()}
              canRestoreTake={activeDocument?.shared?.role !== "viewer"}
              onRestoreTake={(take) => {
                const view = views.current.get(activeIdRef.current ?? "");
                if (!view || !view.state.facet(CodeMirrorView.editable)) return;
                void stopPlayback();
                view.dispatch({
                  changes: { from: 0, to: view.state.doc.length, insert: take.source },
                  annotations: [
                    Transaction.userEvent.of("input.take-restore"),
                    isolateHistory.of("full"),
                  ],
                });
                view.focus();
              }}
              output={audioOutput}
              frames={outputFrames}
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
            mutedTracks={mutedTracks}
            onMixLevel={(id, value) =>
              !exportingNow.current && changeMix(masterLevel, { ...mixLevels, [id]: value })
            }
            onMasterLevel={(value) => !exportingNow.current && changeMix(value, mixLevels)}
            onSoloTrack={(id) => {
              if (!exportingNow.current) setSoloTrack(id);
            }}
            onMuteTrack={(id) => {
              if (exportingNow.current) return;
              setMutedTracks((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            mixColors={mixColors}
            onTrackColor={changeTrackColor}
            onRenameTrack={renameTrack}
          />
        )}
        {assistantOpen &&
          agentAvailable &&
          activeDocument?.shared &&
          activeDocument.shared.role !== "viewer" && (
            <aside className="jam-assistant-pane" aria-label="Assistant">
              <div className="jam-panel-heading">
                <span>ASSISTANT</span>
                <button
                  type="button"
                  aria-label="Close assistant"
                  onClick={() => setAssistantOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>
              <AgentProposalControl
                documentId={activeDocument.id}
                sources={documents.map((document) => ({
                  id: document.id,
                  source: document.source,
                }))}
                onReveal={(documentIds) => {
                  setOpenIds((current) => [...new Set([...current, ...documentIds])]);
                }}
                onApply={(proposal: ChangeProposal) => {
                  const applied = applyReviewedProposal(proposal, views.current, (documentId) => {
                    const shared = drafts.current.get(documentId)?.shared;
                    return (
                      !!shared &&
                      shared.role !== "viewer" &&
                      shared.workspaceId === activeDocument.shared?.workspaceId
                    );
                  });
                  if (!applied) return false;
                  void stopPlayback();
                  views.current.get(activeIdRef.current ?? "")?.focus();
                  return true;
                }}
              />
            </aside>
          )}
      </div>
      <footer className="jam-statusbar">
        <span>{playing ? "● Playing" : "○ Stopped"}</span>
        {activeDocument?.shared && (
          <span>
            {collabStatus === "connected" ? "● Shared" : "○ Shared offline"}
            {presence.length ? ` · ${presence.map((person) => person.name).join(", ")}` : ""}
          </span>
        )}
        <span>
          {saveStatus === "error"
            ? "Save failed"
            : saveStatus === "saving"
              ? "Saving…"
              : sharedOnly
                ? collabStatus === "connected"
                  ? "Connected to shared document"
                  : "Waiting to reconnect"
                : nativeWorkspace
                  ? diskDirty
                    ? "Unsaved on disk · recovery stored locally"
                    : "Saved on disk"
                  : "Saved locally"}
        </span>
        <button
          title="Visual controls are derived from supported source expressions"
          onClick={() => {
            setInspectorOpen(true);
            setAssistantOpen(false);
            if (window.innerWidth < 900) setSidebarOpen(false);
            const preferred =
              model.tracks.find((item) => item.name === selectedTrack) ??
              model.tracks.find((item) => item.lenses.some((lens) => lens.kind === "param")) ??
              model.tracks[0];
            if (preferred) setSelectedTrack(preferred.name);
          }}
        >
          {editableCount ? `${editableCount} source controls` : "No visual controls"}
        </button>
        <button onClick={() => setOutputOpen(!outputOpen)}>
          {outputOpen ? "Hide output" : "Show output"}
        </button>
        {import.meta.env.MODE !== "desktop" && (
          <>
            <a
              href="/app/library"
              onClick={(event) => {
                if (onAppRoute) {
                  event.preventDefault();
                  onAppRoute("/app/library");
                }
              }}
            >
              Library
            </a>
            <a
              href="/app/help"
              onClick={(event) => {
                if (onAppRoute) {
                  event.preventDefault();
                  onAppRoute("/app/help");
                }
              }}
            >
              Help
            </a>
          </>
        )}
        <a href="/licenses/THIRD_PARTY_NOTICES.txt">Licenses</a>
      </footer>
    </div>
  );
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
