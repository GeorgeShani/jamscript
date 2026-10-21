import { useEffect, useRef, useState } from "react";
import { Play, Square, RefreshCw } from "lucide-react";
import { SoundPad, SoundPadGrid, SoundPadLabel, SoundPadShortcut } from "@/components/ui/sound-pad";
import { Waveform } from "@/components/ui/waveform";
import type { RegisteredSample, SamplePreview } from "@/engine/sample-preview";

export function SampleExplorer({
  onReplaceSound,
}: {
  onReplaceSound?: ((name: string, index: number) => boolean) | undefined;
}) {
  const [samples, setSamples] = useState<RegisteredSample[]>([]);
  const [filter, setFilter] = useState("");
  const [preview, setPreview] = useState<SamplePreview | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  const epoch = useRef(0);
  const audio = useRef<typeof import("@/engine/playback") | null>(null);
  const runtime = async () => (audio.current ??= await import("@/engine/playback"));
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSamples(await (await runtime()).listRegisteredSamples());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };
  const stop = () => {
    epoch.current++;
    audio.current?.stopSamplePreview();
    setPlaying(false);
    setBusy(null);
  };
  useEffect(() => {
    const previewEpoch = epoch;
    const stopped = () => {
      previewEpoch.current++;
      setPlaying(false);
      setBusy(null);
    };
    window.addEventListener("jamscript:preview-stopped", stopped);
    return () => {
      window.removeEventListener("jamscript:preview-stopped", stopped);
      previewEpoch.current++;
      audio.current?.stopSamplePreview();
    };
  }, []);
  useEffect(() => {
    if (!playing || !preview) return;
    const timer = setInterval(() => {
      const time = Math.min(
        preview.duration,
        preview.offset + (Date.now() - preview.startedAt) / 1000,
      );
      setPosition(time);
      if (time >= preview.duration) setPlaying(false);
    }, 80);
    return () => clearInterval(timer);
  }, [playing, preview]);
  const audition = async (name: string, index = 0, offset = 0) => {
    const version = ++epoch.current;
    setBusy(name);
    setError(null);
    setPlaying(false);
    try {
      const clip = await (await runtime()).auditionSample(name, index, offset);
      if (version !== epoch.current) return;
      setPreview(clip);
      setPosition(offset);
      setPlaying(true);
    } catch (cause) {
      if (version === epoch.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (version === epoch.current) setBusy(null);
    }
  };
  const visible = samples
    .filter((sample) => sample.name.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 24);
  return (
    <div className="jam-sample-explorer">
      <div className="jam-sample-toolbar">
        <label>
          Registered sounds
          <input
            aria-label="Filter registered samples"
            placeholder="Search a bank or sound…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <button type="button" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={14} />
          {loading ? "Loading…" : samples.length ? "Refresh banks" : "Load sample banks"}
        </button>
      </div>
      {!samples.length && !loading && (
        <p className="jam-muted">
          Load available sample banks. Play your song first to register its custom packs.
          Auditioning leaves your song running.
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      <SoundPadGrid
        hotkeys
        hotkeyScope="focus"
        className="jam-sample-pads"
        aria-label="Sample audition pads"
      >
        {visible.map((sample, index) => (
          <SoundPad
            key={sample.name}
            hotkey={index < 9 ? String(index + 1) : undefined}
            aria-label={`Audition ${sample.name}`}
            loading={busy === sample.name}
            playing={playing && preview?.name === sample.name}
            onTrigger={() => void audition(sample.name)}
            onStop={stop}
          >
            <SoundPadLabel>{sample.name}</SoundPadLabel>
            <SoundPadShortcut />
          </SoundPad>
        ))}
      </SoundPadGrid>
      {samples.length > 0 && (
        <p className="jam-muted">
          {visible.length} of {samples.length} registered sounds · Pad shortcuts work only while
          this grid has focus.
        </p>
      )}
      {preview && (
        <div className="jam-sample-clip">
          <div className="jam-sample-transport">
            <strong>{preview.name}</strong>
            <label>
              Variant
              <select
                aria-label="Sample variant"
                value={preview.index}
                onChange={(event) => void audition(preview.name, Number(event.target.value))}
              >
                {Array.from(
                  {
                    length: Math.min(
                      128,
                      samples.find((sample) => sample.name === preview.name)?.count ?? 1,
                    ),
                  },
                  (_, index) => (
                    <option key={index} value={index}>
                      {index}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button
              type="button"
              aria-label={playing ? "Stop sample preview" : "Play sample preview"}
              onClick={() => (playing ? stop() : void audition(preview.name, preview.index))}
            >
              {playing ? <Square size={14} /> : <Play size={14} />}
            </button>
            <span>
              {position.toFixed(1)} / {preview.duration.toFixed(1)} s
            </span>
            <label>
              Preview volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Sample preview volume"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setVolume(value);
                  audio.current?.setSamplePreviewVolume(value);
                }}
              />
            </label>
          </div>
          <Waveform
            peaks={preview.peaks}
            duration={preview.duration}
            currentTime={position}
            step={0.1}
            largeStep={1}
            aria-label={`${preview.name} waveform`}
            onSeekCommitted={(time) => void audition(preview.name, preview.index, time)}
          />
          <button
            type="button"
            disabled={!onReplaceSound}
            onClick={() => {
              if (!onReplaceSound?.(preview.name, preview.index))
                setError(
                  'Select a single editable s("sound") literal without a bank expression, then retry.',
                );
            }}
          >
            Replace selected sound
          </button>
          <span className="jam-muted">
            {" "}
            Select a single sound literal in the editor. Pattern strings and banked expressions stay
            code-only.
          </span>
        </div>
      )}
    </div>
  );
}
