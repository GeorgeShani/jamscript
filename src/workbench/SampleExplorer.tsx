import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Play, Square, RefreshCw } from "lucide-react";
import { SoundPad, SoundPadGrid, SoundPadLabel, SoundPadShortcut } from "@/components/ui/sound-pad";
import { Waveform } from "@/components/ui/waveform";
import type { RegisteredSample, SamplePreview } from "@/engine/sample-preview";
import { OTHER_SOUNDS as OTHER, sampleBank } from "@/engine/sample-banks";

const PAGE = 48;

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
  const [bank, setBank] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [copied, setCopied] = useState(false);
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
  // Opening the tab is enough; there is no separate step to load the banks.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const banks = useMemo(() => {
    const names = [...new Set(samples.map((sample) => sampleBank(sample.name)))].filter(
      (name) => name !== OTHER,
    );
    return [OTHER, ...names.sort((a, b) => a.localeCompare(b))];
  }, [samples]);
  const matching = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return samples.filter(
      (sample) =>
        (!bank || sampleBank(sample.name) === bank) &&
        (!query || sample.name.toLowerCase().includes(query)),
    );
  }, [samples, filter, bank]);
  const visible = matching.slice(0, shown);
  const snippet = preview ? `s("${preview.name}${preview.index ? `:${preview.index}` : ""}")` : "";
  return (
    <div className="jam-sample-explorer">
      {preview && (
        <div className="jam-sample-clip">
          <div className="jam-sample-transport">
            <strong>{preview.name}</strong>
            <code className="jam-sample-snippet">{snippet}</code>
            <button
              type="button"
              aria-label={`Copy ${snippet}`}
              onClick={() => {
                void navigator.clipboard?.writeText(snippet).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  },
                  () => {},
                );
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
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
      <div className="jam-sample-toolbar">
        <label>
          Sounds
          <input
            aria-label="Filter registered samples"
            placeholder="Search, e.g. bd, piano, 808…"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setShown(PAGE);
            }}
          />
        </label>
        <label>
          Bank
          <select
            aria-label="Sample bank"
            value={bank}
            onChange={(event) => {
              setBank(event.target.value);
              setShown(PAGE);
            }}
          >
            <option value="">All banks</option>
            {banks.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={14} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {!preview && (
        <p className="jam-muted">
          Tap a pad to hear it, then use its name in your code, for example <code>s("bd")</code>.
          Songs that load their own sample packs add them here after you press Play once.
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
      <div className="jam-sample-scroll">
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
          <div className="jam-sample-more">
            <span className="jam-muted">
              Showing {visible.length} of {matching.length}
              {matching.length !== samples.length
                ? ` matching (${samples.length} in total)`
                : " sounds"}
            </span>
            {visible.length < matching.length && (
              <button type="button" onClick={() => setShown((count) => count + PAGE * 2)}>
                Show more
              </button>
            )}
            {visible.length < matching.length && (
              <button type="button" onClick={() => setShown(matching.length)}>
                Show all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
