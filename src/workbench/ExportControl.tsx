import { Download, X } from "lucide-react";
import { DismissibleDetails } from "@/components/ui/dismissible-details";

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
  onExport: (format: "wav" | "mp3", bars: number) => void;
  onCancel: () => void;
}) {
  return (
    <DismissibleDetails className="jam-export-control" dismissOnOutside={!exporting}>
      <summary aria-label="Export audio">
        <Download size={16} />
        <span>Export</span>
      </summary>
      <div className="jam-export-menu">
        <strong>Export full mix</strong>
        <p>Record the current document in real time. Track levels and master level are included.</p>
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
              onExport(data.get("format") === "mp3" ? "mp3" : "wav", Number(data.get("bars")));
            }}
          >
            <label>
              Length
              <select name="bars" defaultValue="8" aria-label="Export length">
                <option value="4">4 bars</option>
                <option value="8">8 bars</option>
                <option value="16">16 bars</option>
              </select>
            </label>
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
