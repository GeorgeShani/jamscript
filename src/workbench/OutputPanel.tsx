import { AudioContextProvider } from "@/hooks/use-audio-context";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";
import { LevelMeter } from "@/components/ui/level-meter";
import { Spectrum } from "@/components/ui/spectrum";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import { SmoothWaveform } from "@/components/ui/smooth-waveform";
import { GripHorizontal } from "lucide-react";
import type { KeyboardEventHandler, PointerEventHandler } from "react";
import { useState, lazy, Suspense } from "react";
const SampleExplorer = lazy(() =>
  import("./SampleExplorer").then((module) => ({ default: module.SampleExplorer })),
);
import type { SyntaxProblem } from "@/features/language/syntax-problems";
import type { TakeRecord } from "@/features/takes/take-store";
import type { FrameSource, MeterFrame, VisualFrame } from "@/lib/types";

interface ResizeHandle {
  min: number;
  max: number;
  now: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerEnd: PointerEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

function TelemetryOutput({
  frames,
}: {
  frames: { meter: FrameSource<MeterFrame>; visual: FrameSource<VisualFrame> };
}) {
  const [view, setView] = useState("spectrum");
  return (
    <div className="jam-output-visuals">
      <div className="jam-level-wrap">
        <span>MASTER</span>
        <LevelMeter source={frames.meter} aria-label="Master output level" orientation="vertical" />
      </div>
      <div className="jam-output-view">
        <label>
          Monitor{" "}
          <select
            aria-label="Output visualization"
            value={view}
            onChange={(event) => setView(event.target.value)}
          >
            <option value="spectrum">Spectrum</option>
            <option value="bars">Frequency bars</option>
            <option value="scope">Waveform</option>
          </select>
        </label>
        {view === "spectrum" ? (
          <Spectrum source={frames.visual} aria-label="Master output spectrum" />
        ) : view === "bars" ? (
          <BarVisualizer
            source={frames.visual}
            barCount={32}
            minLevel={0}
            idle="static"
            aria-label="Master frequency bars"
          />
        ) : (
          <SmoothWaveform source={frames.visual} mode="scope" aria-label="Master output waveform" />
        )}
      </div>
    </div>
  );
}

function LiveOutput({ node }: { node: AudioNode }) {
  const analyser = useAudioAnalyser(node, { channels: "stereo", bands: 32 });
  return <TelemetryOutput frames={analyser} />;
}

export function OutputPanel({
  error,
  output,
  frames = null,
  playing,
  resizeHandle,
  onDismiss,
  problems,
  onSelectProblem,
  takes,
  liveSource,
  auditionTakeId,
  onAuditionTake,
  onRestoreTake,
  onReturnToLive,
  canRestoreTake,
  onReplaceSound,
}: {
  error: string | null;
  output: { context: AudioContext; node: AudioNode } | null;
  frames?: { meter: FrameSource<MeterFrame>; visual: FrameSource<VisualFrame> } | null;
  playing: boolean;
  resizeHandle: ResizeHandle;
  onDismiss: () => void;
  problems: SyntaxProblem[];
  onSelectProblem: (problem: SyntaxProblem) => void;
  takes: TakeRecord[];
  liveSource: string;
  auditionTakeId: string | null;
  onAuditionTake: (take: TakeRecord) => void;
  onRestoreTake: (take: TakeRecord) => void;
  onReturnToLive: () => void;
  canRestoreTake: boolean;
  onReplaceSound?: ((name: string, index: number) => boolean) | undefined;
}) {
  const [tab, setTab] = useState<"output" | "problems" | "takes" | "samples">("output");
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null);
  const selectedTake = takes.find((take) => take.id === selectedTakeId);
  return (
    <section id="jam-output-panel" className="jam-output" aria-label="Output panel">
      <div
        className="jam-panel-heading jam-output-resizer"
        role="separator"
        tabIndex={0}
        title="Drag to resize Output. Use Up and Down arrow keys when focused."
        aria-label="Resize Output panel"
        aria-controls="jam-output-panel"
        aria-orientation="horizontal"
        aria-valuemin={resizeHandle.min}
        aria-valuemax={resizeHandle.max}
        aria-valuenow={resizeHandle.now}
        aria-valuetext={`${resizeHandle.now} pixels; output ${playing ? "live" : "idle"}`}
        onPointerDown={resizeHandle.onPointerDown}
        onPointerMove={resizeHandle.onPointerMove}
        onPointerUp={resizeHandle.onPointerEnd}
        onPointerCancel={resizeHandle.onPointerEnd}
        onKeyDown={resizeHandle.onKeyDown}
      >
        <span className="jam-output-heading-label">Output</span>
        <span className="jam-output-resize-cue" aria-hidden="true">
          <GripHorizontal size={15} /> Drag to resize
        </span>
        <span className="jam-output-state">{playing ? "LIVE" : "IDLE"}</span>
      </div>
      <div className="jam-output-tabs" role="tablist" aria-label="Bottom panel">
        <button
          role="tab"
          aria-selected={tab === "samples"}
          aria-controls="jam-samples-content"
          onClick={() => setTab("samples")}
        >
          Samples
        </button>
        <button
          role="tab"
          aria-selected={tab === "output"}
          aria-controls="jam-output-content"
          onClick={() => setTab("output")}
        >
          Output
        </button>
        <button
          role="tab"
          aria-selected={tab === "takes"}
          aria-controls="jam-takes-content"
          onClick={() => setTab("takes")}
        >
          Takes{takes.length ? ` (${takes.length})` : ""}
        </button>
        <button
          role="tab"
          aria-selected={tab === "problems"}
          aria-controls="jam-problems-content"
          onClick={() => setTab("problems")}
        >
          Problems{problems.length ? ` (${problems.length})` : ""}
        </button>
      </div>
      {tab === "samples" ? (
        <div id="jam-samples-content" role="tabpanel" className="jam-output-body">
          <Suspense fallback={<p className="jam-muted">Opening sample browser…</p>}>
            <SampleExplorer onReplaceSound={onReplaceSound} />
          </Suspense>
        </div>
      ) : tab === "output" ? (
        <div id="jam-output-content" role="tabpanel" className="jam-output-body">
          {error && (
            <div role="alert" className="jam-output-error">
              <span>{error}</span>
              <button onClick={onDismiss}>Dismiss</button>
            </div>
          )}
          {output && playing ? (
            <AudioContextProvider context={output.context}>
              <LiveOutput node={output.node} />
            </AudioContextProvider>
          ) : frames && playing ? (
            <TelemetryOutput frames={frames} />
          ) : (
            <p className="jam-output-idle">Press Play to hear and inspect the active document.</p>
          )}
        </div>
      ) : tab === "takes" ? (
        <div id="jam-takes-content" role="tabpanel" className="jam-output-body jam-takes-body">
          {takes.length ? (
            <>
              <div className="jam-takes-list" aria-label="Saved Takes">
                {takes.map((take) => (
                  <button
                    key={take.id}
                    type="button"
                    aria-pressed={selectedTakeId === take.id}
                    onClick={() => setSelectedTakeId(take.id)}
                  >
                    {take.label ?? "Saved Take"} · {new Date(take.createdAt).toLocaleString()}
                    {auditionTakeId === take.id ? " · Auditioning" : ""}
                  </button>
                ))}
              </div>
              {selectedTake && (
                <div className="jam-take-details">
                  <p>
                    {selectedTake.source === liveSource
                      ? "Matches the current document."
                      : `${selectedTake.source.split("\n").length} saved lines · ${liveSource.split("\n").length} live lines`}
                  </p>
                  <div className="jam-take-actions">
                    <button type="button" onClick={() => onAuditionTake(selectedTake)}>
                      Audition
                    </button>
                    {auditionTakeId && (
                      <button type="button" onClick={onReturnToLive}>
                        Back to live
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!canRestoreTake || selectedTake.source === liveSource}
                      onClick={() => onRestoreTake(selectedTake)}
                    >
                      Restore to editor
                    </button>
                  </div>
                  <details>
                    <summary>Compare source</summary>
                    <div className="jam-take-compare">
                      <div>
                        <strong>Saved Take</strong>
                        <pre>{selectedTake.source}</pre>
                      </div>
                      <div>
                        <strong>Live editor</strong>
                        <pre>{liveSource}</pre>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </>
          ) : (
            <p>No Takes yet. A successful Play saves the first one on this device.</p>
          )}
        </div>
      ) : (
        <div
          id="jam-problems-content"
          role="tabpanel"
          className="jam-output-body jam-problems-body"
        >
          {problems.length ? (
            <ul>
              {problems.map((problem, index) => (
                <li key={`${problem.from}-${problem.to}-${index}`}>
                  <button onClick={() => onSelectProblem(problem)}>
                    <span>{problem.message}</span>
                    <span>
                      Line {problem.line}, column {problem.column}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No syntax problems found.</p>
          )}
        </div>
      )}
    </section>
  );
}
