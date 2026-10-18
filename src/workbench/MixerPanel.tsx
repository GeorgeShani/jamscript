import { useState } from "react";
import { Palette, Pencil } from "lucide-react";
import type { MixTrack } from "@/engine/mix-source";

const PALETTE = ["Sky", "Pink", "Green", "Yellow", "Coral", "Violet"] as const;

function mixerTrackLabel(name: string) {
  return name.replace(/(?:\s+\([^()]*\))+$/, "").trim() || name;
}

function Level({
  label,
  ariaLabel = label,
  value,
  color,
  onChange,
}: {
  label: string;
  ariaLabel?: string;
  value: number;
  color?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="jam-mix-level">
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        aria-label={`${ariaLabel} level`}
        style={color ? { accentColor: color } : undefined}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <output>{Math.round(value * 100)}%</output>
    </label>
  );
}

export function MixerPanel({
  tracks,
  levels,
  master,
  solo,
  muted,
  selected,
  colors,
  onLevel,
  onMaster,
  onSolo,
  onMute,
  onSelect,
  onColor,
  onRename,
  emptyMessage,
}: {
  tracks: MixTrack[];
  levels: Record<string, number>;
  master: number;
  solo: string | null;
  muted: ReadonlySet<string>;
  selected?: string | null;
  colors: Record<string, number>;
  onLevel: (id: string, value: number) => void;
  onMaster: (value: number) => void;
  onSolo: (id: string | null) => void;
  onMute: (id: string) => void;
  onSelect?: (id: string) => void;
  onColor: (orbit: number, color: number) => void;
  onRename: (id: string, name: string) => boolean;
  emptyMessage?: string | undefined;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [colorOpen, setColorOpen] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  const submitRename = (id: string) => {
    if (name.trim() === id) {
      setRenaming(null);
      setRenameError(null);
      return;
    }
    if (onRename(id, name)) {
      setRenaming(null);
      setRenameError(null);
    } else {
      setRenameError(
        "Use a unique name of up to 40 letters, numbers, spaces, _ or -. Code labels must be valid JavaScript names.",
      );
    }
  };

  return (
    <section className="jam-inspector-section jam-mixer" aria-label="Mixer">
      <h2>Mixer</h2>
      <Level label="Master" value={master} onChange={onMaster} />
      {tracks.length > 0 ? (
        <div className="jam-mix-tracks">
          {tracks.map((track) => {
            const color = `var(--jam-track-${track.orbit}, var(--track-${((track.orbit - 64) % 6) + 1}))`;
            const displayName = mixerTrackLabel(track.name);
            return (
              <div
                className={selected === track.id ? "jam-mix-track is-selected" : "jam-mix-track"}
                key={track.orbit}
              >
                {renaming === track.id ? (
                  <form
                    className="jam-mix-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitRename(track.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setRenaming(null);
                        setRenameError(null);
                      }
                    }}
                  >
                    <input
                      aria-label={`New name for ${track.name}`}
                      value={name}
                      maxLength={40}
                      onChange={(event) => {
                        setName(event.target.value);
                        setRenameError(null);
                      }}
                      autoFocus
                    />
                    <button type="submit">Save</button>
                    <button type="button" onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                    {renameError && <p role="alert">{renameError}</p>}
                  </form>
                ) : (
                  <div className="jam-mix-track-heading">
                    <button
                      type="button"
                      className="jam-mix-track-name"
                      aria-label={`Inspect ${displayName}`}
                      title={`Inspect ${displayName}`}
                      aria-pressed={selected === track.id}
                      onClick={() => onSelect?.(track.id)}
                    >
                      <span className="jam-track-dot" style={{ backgroundColor: color }} />
                      {displayName}
                    </button>
                    <div className="jam-mix-track-actions">
                      <button
                        type="button"
                        aria-label={`Rename ${displayName}`}
                        title="Rename track in code"
                        onClick={() => {
                          setColorOpen(null);
                          setRenaming(track.id);
                          setName(track.name);
                          setRenameError(null);
                        }}
                      >
                        <Pencil size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Change ${displayName} color`}
                        aria-expanded={colorOpen === track.id}
                        title="Track color"
                        onClick={() => setColorOpen(colorOpen === track.id ? null : track.id)}
                      >
                        <Palette size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={solo === track.id ? "is-solo" : ""}
                        aria-label={`${solo === track.id ? "Unsolo" : "Solo"} ${displayName}`}
                        aria-pressed={solo === track.id}
                        onClick={() => onSolo(solo === track.id ? null : track.id)}
                      >
                        S
                      </button>
                      <button
                        type="button"
                        className={muted.has(track.id) ? "is-mute" : ""}
                        aria-label={`${muted.has(track.id) ? "Unmute" : "Mute"} ${displayName}`}
                        aria-pressed={muted.has(track.id)}
                        onClick={() => onMute(track.id)}
                      >
                        M
                      </button>
                    </div>
                  </div>
                )}
                {colorOpen === track.id && (
                  <div
                    className="jam-mix-palette"
                    role="group"
                    aria-label={`${displayName} colors`}
                  >
                    {PALETTE.map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        aria-label={`${label} for ${displayName}`}
                        aria-pressed={
                          (colors[String(track.orbit)] ?? ((track.orbit - 64) % 6) + 1) ===
                          index + 1
                        }
                        title={label}
                        style={{ backgroundColor: `var(--track-${index + 1})` }}
                        onClick={() => {
                          onColor(track.orbit, index + 1);
                          setColorOpen(null);
                        }}
                      />
                    ))}
                  </div>
                )}
                <Level
                  label="Level"
                  ariaLabel={displayName}
                  value={levels[track.id] ?? 1}
                  color={color}
                  onChange={(value) => onLevel(track.id, value)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="jam-mix-hint">
          {emptyMessage ?? "Use labeled patterns or a top-level stack to mix parts separately."}
        </p>
      )}
    </section>
  );
}
