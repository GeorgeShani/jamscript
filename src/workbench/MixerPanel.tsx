import type { MixTrack } from "@/engine/mix-source";

function Level({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
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
        aria-label={`${label} level`}
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
  onLevel,
  onMaster,
  onSolo,
}: {
  tracks: MixTrack[];
  levels: Record<string, number>;
  master: number;
  solo: string | null;
  onLevel: (id: string, value: number) => void;
  onMaster: (value: number) => void;
  onSolo: (id: string | null) => void;
}) {
  return (
    <section className="jam-inspector-section jam-mixer" aria-label="Mixer">
      <h2>MIXER</h2>
      <Level label="Master" value={master} onChange={onMaster} />
      {tracks.length > 0 ? (
        <div className="jam-mix-tracks">
          {tracks.map((track) => (
            <div className="jam-mix-track" key={track.id}>
              <div className="jam-mix-track-heading">
                <span title={track.name}>{track.name}</span>
                <button
                  type="button"
                  className={solo === track.id ? "is-solo" : ""}
                  aria-label={`${solo === track.id ? "Unsolo" : "Solo"} ${track.name}`}
                  aria-pressed={solo === track.id}
                  onClick={() => onSolo(solo === track.id ? null : track.id)}
                >
                  S
                </button>
              </div>
              <Level
                label={track.name}
                value={levels[track.id] ?? 1}
                onChange={(value) => onLevel(track.id, value)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="jam-mix-hint">
          Use labeled patterns or a top-level stack to mix parts separately.
        </p>
      )}
    </section>
  );
}
