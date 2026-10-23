import { useState } from "react";
import { Download, X } from "lucide-react";
import { DismissibleDetails } from "@/components/ui/dismissible-details";
import { MAX_EXPORT_SECONDS, MIN_EXPORT_SECONDS } from "@/engine/export-audio-limits";

const PRESETS = [
  { value: "15", label: "15 seconds" },
  { value: "30", label: "30 seconds" },
  { value: "60", label: "1 minute" },
  { value: "120", label: "2 minutes" },
  { value: "300", label: "5 minutes" },
] as const;

export function ExportControl({
  disabled,
  exporting,
  progress,
  onExport,
  onCancel,
}: {
  disabled: boolean;
  exporting: boolean;
  progress: number;
  onExport: (format: "wav" | "mp3", seconds: number) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState("30");
  const custom = choice === "custom";
  return (
    <DismissibleDetails className="jam-export-control" dismissOnOutside={!exporting}>
      <summary aria-label="Export audio">
        <Download size={16} />
        <span>Export</span>
      </summary>
      <div className="jam-export-menu">
        <strong>Export full mix</strong>
        <p>
          Records the song as it plays, so a 1-minute export takes about a minute. It stops at the
          end of the loop after your chosen length, so the audio ends cleanly. Track levels and
          master level are included.
        </p>
        {exporting ? (
          <div className="jam-export-progress" role="status">
            <progress max={100} value={Math.round(progress * 100)} />
            <span>{Math.round(progress * 100)}%</span>
            <button type="button" onClick={onCancel}>
              <X size={13} /> Cancel
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const seconds = custom ? Number(data.get("custom")) : Number(data.get("length"));
              if (!Number.isFinite(seconds)) return;
              onExport(
                data.get("format") === "mp3" ? "mp3" : "wav",
                Math.min(MAX_EXPORT_SECONDS, Math.max(MIN_EXPORT_SECONDS, Math.round(seconds))),
              );
            }}
          >
            <label>
              Length
              <select
                name="length"
                value={choice}
                onChange={(event) => setChoice(event.target.value)}
                aria-label="Export length"
              >
                {PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </label>
            {custom && (
              <label>
                Seconds (1–{MAX_EXPORT_SECONDS})
                <input
                  name="custom"
                  type="number"
                  inputMode="numeric"
                  min={MIN_EXPORT_SECONDS}
                  max={MAX_EXPORT_SECONDS}
                  step={1}
                  defaultValue={90}
                  required
                  aria-label="Custom export length in seconds"
                />
              </label>
            )}
            <label>
              Format
              <select name="format" defaultValue="wav" aria-label="Export format">
                <option value="wav">WAV</option>
                <option value="mp3">MP3</option>
              </select>
            </label>
            <button type="submit" disabled={disabled}>
              Record &amp; download
            </button>
          </form>
        )}
      </div>
    </DismissibleDetails>
  );
}
