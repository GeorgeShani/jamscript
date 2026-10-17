import { useRef } from "react";
import { isolateHistory } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { dispatchLensEdit } from "@/components/jam/code-editor";
import {
  Knob,
  KnobDial,
  KnobLabel,
  KnobPointer,
  KnobRange,
  KnobTrack,
  KnobValue,
} from "@/components/ui/knob";
import {
  ParameterSlider,
  ParameterSliderControl,
  ParameterSliderHeader,
  ParameterSliderLabel,
  ParameterSliderValue,
} from "@/components/ui/parameter-slider";
import { PARAMS, type MusicTrack, type ParamLens } from "@/engine/music-document";
import type { MixTrack } from "@/engine/mix-source";
import { MixerPanel } from "./MixerPanel";

export function TrackInspector({
  track,
  tracks,
  valid,
  view,
  onSelectTrack,
  mixTracks,
  mixLevels,
  masterLevel,
  soloTrack,
  onMixLevel,
  onMasterLevel,
  onSoloTrack,
  mixColors,
  onTrackColor,
  onRenameTrack,
}: {
  track: MusicTrack | null;
  tracks: MusicTrack[];
  valid: boolean;
  view: EditorView | null;
  onSelectTrack: (name: string) => void;
  mixTracks: MixTrack[];
  mixLevels: Record<string, number>;
  masterLevel: number;
  soloTrack: string | null;
  onMixLevel: (id: string, value: number) => void;
  onMasterLevel: (value: number) => void;
  onSoloTrack: (id: string | null) => void;
  mixColors: Record<string, number>;
  onTrackColor: (orbit: number, color: number) => void;
  onRenameTrack: (id: string, name: string) => boolean;
}) {
  const gestures = useRef(new Map<string, number>());
  const edit = (lens: ParamLens, value: number, reason: string) => {
    if (!view) return;
    let time = gestures.current.get(lens.id);
    if (reason === "drag" && time === undefined) {
      time = Date.now();
      gestures.current.set(lens.id, time);
    }
    dispatchLensEdit(view, { target: lens.id, value }, reason === "drag" ? time : undefined);
  };
  const commit = (lens: ParamLens) => {
    if (gestures.current.delete(lens.id))
      view?.dispatch({ annotations: isolateHistory.of("after") });
  };
  const parameters = track?.lenses.filter((lens): lens is ParamLens => lens.kind === "param") ?? [];

  return (
    <aside className="jam-inspector" aria-label="Track inspector">
      <div className="jam-panel-heading">INSPECTOR</div>
      <MixerPanel
        tracks={mixTracks}
        levels={mixLevels}
        master={masterLevel}
        solo={soloTrack}
        onLevel={onMixLevel}
        onMaster={onMasterLevel}
        onSolo={onSoloTrack}
        colors={mixColors}
        onColor={onTrackColor}
        onRename={onRenameTrack}
        emptyMessage={
          tracks.length > 0
            ? "Track faders are unavailable for this source. Original audio routing is preserved; source controls below still work."
            : undefined
        }
      />
      {!valid ? (
        <p className="jam-inspector-empty">Fix the code syntax to inspect tracks.</p>
      ) : tracks.length === 0 ? (
        <p className="jam-inspector-empty">
          No safe visual controls found. Literal gain, room, and filter arguments in supported
          Strudel chains appear here; computed expressions stay editable in code.
        </p>
      ) : (
        <>
          <div className="jam-inspector-section">
            <h2>TRACKS</h2>
            <div className="jam-track-list">
              {tracks.map((item) => (
                <button
                  key={item.name}
                  className={item.name === track?.name ? "is-active" : ""}
                  onClick={() => onSelectTrack(item.name)}
                >
                  <span
                    className="jam-track-dot"
                    style={{
                      backgroundColor: `var(--jam-track-${item.orbit}, var(--track-${item.color}))`,
                    }}
                  />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <div className="jam-inspector-section">
            <h2>{track?.name.toUpperCase()} · PARAMETERS</h2>
            {parameters.length ? (
              <div className="jam-parameter-list">
                {parameters.map((lens) => {
                  const spec = PARAMS[lens.name];
                  return (
                    <div className="jam-parameter" key={lens.id}>
                      <Knob
                        min={spec.min}
                        max={spec.max}
                        step={spec.step}
                        scale={spec.log ? "log" : "linear"}
                        value={lens.value}
                        size="sm"
                        onValueChange={(value, details) => edit(lens, value, details.reason)}
                        onValueCommitted={() => commit(lens)}
                      >
                        <KnobDial>
                          <KnobTrack />
                          <KnobRange />
                          <KnobPointer />
                        </KnobDial>
                        <KnobValue />
                        <KnobLabel>{lens.name}</KnobLabel>
                      </Knob>
                      <ParameterSlider
                        min={spec.min}
                        max={spec.max}
                        step={spec.step}
                        scale={spec.log ? "log" : "linear"}
                        value={lens.value}
                        onValueChange={(value, details) => edit(lens, value, details.reason)}
                        onValueCommitted={() => commit(lens)}
                      >
                        <ParameterSliderHeader>
                          <ParameterSliderLabel>{lens.name.toUpperCase()}</ParameterSliderLabel>
                          <ParameterSliderValue />
                        </ParameterSliderHeader>
                        <ParameterSliderControl />
                      </ParameterSlider>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="jam-inspector-empty">
                This track has no supported numeric parameters. Edit its code directly.
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
