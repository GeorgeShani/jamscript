import { AudioContextProvider } from "@/hooks/use-audio-context";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";
import { LevelMeter } from "@/components/ui/level-meter";
import { Spectrum } from "@/components/ui/spectrum";
import { GripHorizontal } from "lucide-react";
import type { KeyboardEventHandler, PointerEventHandler } from "react";
import { useState } from "react";
import type { SyntaxProblem } from "@/features/language/syntax-problems";
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
  return (
    <div className="jam-output-visuals">
      <div className="jam-level-wrap">
        <span>MASTER</span>
        <LevelMeter source={frames.meter} aria-label="Master output level" orientation="vertical" />
      </div>
      <Spectrum source={frames.visual} aria-label="Master output spectrum" />
    </div>
  );
}

function LiveOutput({ node }: { node: AudioNode }) {
  const analyser = useAudioAnalyser(node, { channels: "stereo", bands: 32 });
  return (
    <div className="jam-output-visuals">
      <div className="jam-level-wrap">
        <span>MASTER</span>
        <LevelMeter
          source={analyser.meter}
          aria-label="Master output level"
          orientation="vertical"
        />
      </div>
      <Spectrum source={analyser.visual} aria-label="Master output spectrum" />
    </div>
  );
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
}: {
  error: string | null;
  output: { context: AudioContext; node: AudioNode } | null;
  frames?: { meter: FrameSource<MeterFrame>; visual: FrameSource<VisualFrame> } | null;
  playing: boolean;
  resizeHandle: ResizeHandle;
  onDismiss: () => void;
  problems: SyntaxProblem[];
  onSelectProblem: (problem: SyntaxProblem) => void;
}) {
  const [tab, setTab] = useState<"output" | "problems">("output");
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
        <span className="jam-output-heading-label">OUTPUT</span>
        <span className="jam-output-resize-cue" aria-hidden="true">
          <GripHorizontal size={15} /> DRAG TO RESIZE
        </span>
        <span className="jam-output-state">{playing ? "LIVE" : "IDLE"}</span>
      </div>
      <div className="jam-output-tabs" role="tablist" aria-label="Bottom panel">
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
          aria-selected={tab === "problems"}
          aria-controls="jam-problems-content"
          onClick={() => setTab("problems")}
        >
          Problems{problems.length ? ` (${problems.length})` : ""}
        </button>
      </div>
      {tab === "output" ? (
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
