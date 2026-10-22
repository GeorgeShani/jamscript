// Thin playback adapter. The ONLY file that imports @strudel/web (AGPL-3.0-or-later,
// licence notices kept intact in node_modules). Everything here is browser-only:
// the library is loaded with a dynamic import so nothing runs on the server or
// at page load. Evaluation is serialized and pending source changes are coalesced.

type StrudelWeb = typeof import("@strudel/web");
import { installAudioCache, onMissingSample } from "./audio-cache";
import {
  editorOffsetFromPlayback,
  prepareMix,
  type MixTrack,
  type MovedPattern,
} from "./mix-source";
import { createWorkerTimer } from "./worker-timer";
import { registerBundledSoundfonts } from "./register-soundfonts";
import { preloadPatternAssets, type PreloadPattern } from "./preload-pattern";
import {
  registeredSamples,
  auditionRegisteredSample,
  stopSamplePreview as stopPreviewVoice,
} from "./sample-preview";
export { setSamplePreviewVolume } from "./sample-preview";
let previewRevision = 0;
export function stopSamplePreview() {
  previewRevision++;
  stopPreviewVoice();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("jamscript:preview-stopped"));
}
import type { PlaybackRange } from "@/components/jam/playback-highlights";

let initPromise: Promise<StrudelWeb> | null = null;
let errorCallback: ((message: string) => void) | null = null;
let evaluationError: string | null = null;
let revision = 0;
let allowed = false;
let work: Promise<boolean> = Promise.resolve(false);
let activeStrudel: StrudelWeb | null = null;
let preparation: AbortController | null = null;
let evaluationRevision = 0;
let evaluationSignal: AbortSignal | undefined;
let fading = false;
let started = false;
let livePattern: PreloadPattern | null = null;
let liveScan: ReturnType<typeof setTimeout> | null = null;
let mixTracks: MixTrack[] = [];
let movedPattern: MovedPattern | undefined;
let mixLevels: Record<string, number> = {};
let soloTrack: string | null = null;
let mutedTracks = new Set<string>();
let masterLevel = 1;
let mixTimer: ReturnType<typeof setInterval> | null = null;
let mixEnabled = false;
let source = "";
let playbackCode = "";
let miniLocations = new Set<string>();
let highlightCallback: ((ranges: PlaybackRange[]) => void) | null = null;
const highlightTimers = new Set<ReturnType<typeof setTimeout>>();

function clearHighlightTimers() {
  for (const timer of highlightTimers) clearTimeout(timer);
  highlightTimers.clear();
}

function scheduleHighlight(hap: unknown, when: number, context: AudioContext) {
  if (!highlightCallback || !allowed || !Number.isFinite(when)) return;
  // Nobody sees the flash in a hidden tab, and its editor work competes with the scheduler.
  if (typeof document !== "undefined" && document.hidden) return;
  const locations = (hap as { context?: { locations?: { start: number; end: number }[] } }).context
    ?.locations;
  if (!locations?.length) return;
  const ranges = locations.flatMap(({ start, end }) => {
    if (miniLocations.size && !miniLocations.has(`${start}:${end}`)) return [];
    const from = editorOffsetFromPlayback(start, mixTracks, movedPattern);
    const to = editorOffsetFromPlayback(end, mixTracks, movedPattern);
    if (
      from === null ||
      to === null ||
      from >= to ||
      to > source.length ||
      playbackCode.slice(start, end) !== source.slice(from, to)
    )
      return [];
    return [{ from, to }];
  });
  if (!ranges.length) return;
  const scheduledRevision = revision;
  const delay = Math.max(0, (when - context.currentTime) * 1000);
  const timer = setTimeout(() => {
    highlightTimers.delete(timer);
    if (allowed && revision === scheduledRevision) highlightCallback?.(ranges);
  }, delay);
  highlightTimers.add(timer);
}

export function onHighlight(callback: ((ranges: PlaybackRange[]) => void) | null) {
  highlightCallback = callback;
  if (!callback) clearHighlightTimers();
}

/** Applies the mixer; returns true once every track's orbit node exists and was updated. */
function applyMix(): boolean {
  if (!mixEnabled) return false;
  const controller = activeStrudel?.getSuperdoughAudioController?.();
  const context = activeStrudel?.getAudioContext?.() as AudioContext | undefined;
  if (!controller || !context) return false;
  const master = controller.output?.destinationGain?.gain as AudioParam | undefined;
  if (master) {
    // A quick restart must cancel the previous Stop's fade-to-zero automation.
    if (fading) {
      if (master.cancelAndHoldAtTime) master.cancelAndHoldAtTime(context.currentTime);
      else master.cancelScheduledValues?.(context.currentTime);
      fading = false;
    }
    master.setTargetAtTime(masterLevel, context.currentTime, 0.015);
  }
  let complete = true;
  for (const track of mixTracks) {
    const gain = controller.nodes?.[track.orbit]?.output?.gain as AudioParam | undefined;
    if (!gain) {
      complete = false;
      continue;
    }
    const level = mixLevels[track.id] ?? 1;
    // Solo wins: only the soloed track plays. Otherwise mute silences a track.
    const target = soloTrack
      ? soloTrack === track.id
        ? level
        : 0
      : mutedTracks.has(track.id)
        ? 0
        : level;
    gain.setTargetAtTime(target, context.currentTime, 0.015);
  }
  return complete;
}

/** Runtime mixer settings do not modify CodeMirror or restart the scheduler. */
export function setMix(
  levels: Record<string, number>,
  solo: string | null,
  master: number,
  muted?: readonly string[],
) {
  mixLevels = levels;
  soloTrack = solo;
  // Omit muted to keep the current mute set (e.g. levels-only updates). Pass [] to clear.
  if (muted !== undefined) mutedTracks = new Set(muted);
  masterLevel = master;
  applyMix();
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Stop new notes immediately; user Stop fades tails, errors mute immediately. */
function silence(strudel: StrudelWeb, smooth = false) {
  try {
    const context = strudel.getAudioContext?.() as AudioContext | undefined;
    const gain = strudel.getSuperdoughAudioController?.()?.output?.destinationGain?.gain as
      AudioParam | undefined;
    if (context && gain) {
      const now = context.currentTime;
      if (smooth && gain.linearRampToValueAtTime) {
        if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
        else {
          gain.cancelScheduledValues?.(now);
          gain.setValueAtTime?.(gain.value, now);
        }
        gain.linearRampToValueAtTime(0, now + 0.35);
        fading = true;
      } else {
        gain.cancelScheduledValues?.(now);
        gain.setValueAtTime?.(0, now);
        fading = false;
      }
    }
  } catch {
    // A broken audio graph must not prevent the scheduler from stopping.
  }
  try {
    strudel.hush();
  } catch {
    // The master gain still reaches silence if the scheduler fails.
  }
}

/**
 * superdough computes `parseInt(undefined) ?? 128`, which is NaN, so without an explicit
 * value its voice limit never applies and long tails pile up on the audio thread.
 */
const MAX_POLYPHONY = 128;
const SAMPLE_BANKS = [
  "tidal-drum-machines",
  "piano",
  "Dirt-Samples",
  "EmuSP12",
  "vcsl",
  "mridangam",
];

/** Refreshes the bundled bank index from upstream once the page is idle; failures are ignored. */
function scheduleIndexRefresh(strudel: StrudelWeb) {
  const refresh = () => {
    const base = "https://raw.githubusercontent.com/felixroos/dough-samples/main";
    void Promise.allSettled(SAMPLE_BANKS.map((bank) => strudel.samples(`${base}/${bank}.json`)));
  };
  const idle = (window as { requestIdleCallback?: (run: () => void, o?: object) => void })
    .requestIdleCallback;
  if (idle) idle(refresh, { timeout: 15_000 });
  else setTimeout(refresh, 5_000);
}

/** Loads @strudel/web and prebakes the drum samples once. Later calls return the same promise. */
export function initPlayback(): Promise<StrudelWeb> {
  if (!initPromise) {
    initPromise = (async () => {
      // The SSR branch is dead-code-eliminated in the client build and vice versa,
      // so the server bundle never contains (or evaluates) the Strudel chunk.
      if (import.meta.env.SSR) throw new Error("playback is browser-only");
      installAudioCache();
      const strudel = await import("@strudel/web");
      let upcoming: PreloadPattern | null = null;
      // Strudel REPL snippets can include editor-only visual widgets. They do
      // not affect the sound; JamScript renders its own output visualization.
      const patternMethods = strudel.Pattern.prototype as unknown as Record<string, unknown>;
      for (const name of ["_punchcard", "_scope"]) {
        if (typeof patternMethods[name] !== "function")
          Object.defineProperty(patternMethods, name, {
            value: function (this: unknown) {
              return this;
            },
            configurable: true,
          });
      }
      // The default "interactive" hint asks for the smallest output buffer, which
      // underruns first when the CPU is busy. Strudel already schedules 100 ms ahead,
      // so a larger buffer costs nothing audible and avoids crackles.
      try {
        if (typeof strudel.setAudioContext === "function")
          strudel.setAudioContext(new AudioContext({ latencyHint: "playback" }));
      } catch {
        // Keep Strudel's default context if this browser rejects the option.
      }
      const timer = createWorkerTimer();
      await strudel.initStrudel({
        // The scheduler's clock runs in a worker so a busy or hidden page cannot starve it.
        setInterval: timer.setInterval,
        clearInterval: timer.clearInterval,
        editPattern: (pattern: PreloadPattern) => {
          upcoming = pattern;
          // beforeStart only runs on a cold Play. Live edits that introduce new
          // samples would otherwise fetch them when the first note fires, late.
          // A knob drag re-evaluates many times a second; scan once the edits settle.
          if (started) {
            livePattern = pattern;
            liveScan ??= setTimeout(() => {
              liveScan = null;
              const latest = livePattern;
              livePattern = null;
              if (latest && started && allowed)
                void preloadPatternAssets(
                  latest,
                  strudel,
                  () => allowed && started,
                  evaluationSignal,
                  { waitForAll: false, onBackgroundError: () => {} },
                ).catch(() => {});
            }, 400);
          }
          return pattern;
        },
        beforeStart: async () => {
          const startingRevision = evaluationRevision;
          if (upcoming)
            await preloadPatternAssets(
              upcoming,
              strudel,
              () => allowed && revision === startingRevision,
              evaluationSignal,
              {
                waitForAll: false,
                onBackgroundError: (error) =>
                  errorCallback?.(`Could not prepare upcoming audio: ${message(error)}`),
              },
            );
        },
        onEvalError: (error: unknown) => {
          evaluationError = message(error);
        },
        afterEval: ({ meta }: { meta?: { miniLocations?: [number, number][] } }) => {
          miniLocations = new Set((meta?.miniLocations ?? []).map(([from, to]) => `${from}:${to}`));
        },
        defaultOutput: async (
          hap: unknown,
          deadline: number,
          duration: number,
          cps: number,
          when: number,
        ) => {
          await strudel.webaudioOutput(hap, deadline, duration, cps, when);
          const context = strudel.getAudioContext() as AudioContext;
          if (context) scheduleHighlight(hap, when, context);
        },
        prebake: async () => {
          // Match the REPL's default banks, including rim and other named drums. The
          // bank index ships with the app so Play never waits on GitHub; the audio files
          // stay remote until self-hosted with their licences.
          const { default: index } = await import("./sample-index.generated.json");
          await Promise.all([
            registerBundledSoundfonts(strudel),
            ...Object.values(index).map((bank) => strudel.samples(bank)),
          ]);
          scheduleIndexRefresh(strudel);
        },
      });
      // initStrudel installs a first-mousedown listener, but the first Play
      // click may happen before that listener exists. Load worklets explicitly.
      await strudel.initAudio({ maxPolyphony: MAX_POLYPHONY });
      activeStrudel = strudel;
      return strudel;
    })().catch((error: unknown) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

/** Prepare the runtime ahead of Play without evaluating user code or starting notes. */
export async function warmPlayback(): Promise<void> {
  await initPlayback();
}

/**
 * Fetches and decodes the samples a song names, ahead of Play. This only reads string
 * literals; it never evaluates the document or starts notes, so shared code cannot run
 * without the user pressing Play. Unknown or dynamic names are simply skipped.
 */
export async function warmSource(text: string): Promise<void> {
  if (allowed || !text) return;
  const strudel = await initPlayback();
  const words = new Set<string>();
  const literals = /"([^"\n]{1,400})"|'([^'\n]{1,400})'|\x60([^\x60\n]{1,400})\x60/g;
  for (const literal of text.matchAll(literals)) {
    const body = literal[1] ?? literal[2] ?? literal[3] ?? "";
    for (const word of body.split(/[\s,[\]{}()<>*!@~?|/%^$+=-]+/))
      if (word && words.size < 80) words.add(word);
  }
  const tokens = [...words];
  const jobs = new Map<string, () => Promise<unknown>>();
  for (const token of tokens) {
    const [name = "", index] = token.split(":");
    for (const candidate of [name, ...tokens.slice(0, 24).map((bank) => `${bank}_${name}`)]) {
      const data = strudel.getSound(candidate)?.data;
      if (data?.type !== "sample" || !data.samples) continue;
      const value = { s: candidate, n: index === undefined ? 0 : Number(index) || 0 };
      const url = strudel.getSampleInfo(value, data.samples).url;
      if (!jobs.has(url)) jobs.set(url, () => strudel.getSampleBuffer(value, data.samples));
    }
  }
  const queue = [...jobs.values()].slice(0, 24);
  const worker = async () => {
    for (let load = queue.shift(); load; load = queue.shift()) {
      if (allowed) return;
      await load().catch(() => {
        // A failed warm-up only means Play fetches the sample itself.
      });
    }
  };
  await Promise.all([worker(), worker()]);
}

/** Evaluates the session code like the Strudel REPL. Never throws: errors go to onError. */
export function play(code: string): Promise<boolean> {
  const request = ++revision;
  preparation?.abort();
  const startup = new AbortController();
  preparation = startup;
  allowed = true;
  mixEnabled = false;
  work = work
    .catch(() => false)
    .then(async () => {
      if (!allowed || request !== revision) return false;
      let strudel: StrudelWeb | null = null;
      try {
        strudel = await initPlayback();
        if (!allowed || request !== revision) return false;
        evaluationError = null;
        const mix = prepareMix(code);
        clearHighlightTimers();
        source = code;
        playbackCode = mix.code;
        movedPattern = mix.moved;
        miniLocations.clear();
        mixTracks = mix.mixable === false ? [] : mix.tracks;
        evaluationRevision = request;
        evaluationSignal = startup.signal;
        // The first-gesture audio init resets the limit to NaN; set it before the song runs
        // so a song's own setMaxPolyphony() still wins.
        strudel.setMaxPolyphony?.(MAX_POLYPHONY);
        await strudel.evaluate(mix.code);
        if (!allowed) {
          mixEnabled = false;
          silence(strudel);
          return false;
        }
        if (request !== revision) {
          mixEnabled = false;
          silence(strudel);
          return false;
        }
        if (evaluationError) {
          // Strudel can leave its previous pattern running when evaluate reports
          // an error through onEvalError instead of rejecting. Keep transport and
          // UI in sync by silencing it before reporting Play as failed.
          allowed = false;
          mixEnabled = false;
          started = false;
          silence(strudel);
          errorCallback?.(evaluationError);
          return false;
        }
        if (mixTimer) clearInterval(mixTimer);
        mixEnabled = true;
        started = true;
        applyMix();
        // Orbits are created lazily on their first note. Poll only until every track
        // has its node; later changes arrive through setMix.
        mixTimer = setInterval(() => {
          if (applyMix() && mixTimer) {
            clearInterval(mixTimer);
            mixTimer = null;
          }
        }, 150);
        return true;
      } catch (error) {
        // evaluate() may start a scheduler before rejecting. Do not let a failed
        // Play leave audio running behind an Idle transport.
        if (strudel) silence(strudel);
        mixEnabled = false;
        started = false;
        if (allowed && request === revision) {
          allowed = false;
          errorCallback?.(message(error));
        }
        return false;
      }
    });
  return work;
}

/**
 * Stops the scheduler so no new notes start. By default voices that are already sounding
 * keep their release and delay tails and decay naturally, as in the Strudel REPL. Pass
 * `ringOut: false` to cut everything quickly instead, e.g. before an export.
 */
export async function stop({ ringOut = true }: { ringOut?: boolean } = {}): Promise<void> {
  stopSamplePreview();
  allowed = false;
  started = false;
  preparation?.abort();
  mixEnabled = false;
  clearHighlightTimers();
  if (mixTimer) clearInterval(mixTimer);
  mixTimer = null;
  const stoppedAt = ++revision;
  // Release the transport immediately even if a sample manifest or worklet is
  // still loading. A stale initialization hushes only if no newer Play won.
  if (activeStrudel) {
    if (ringOut) {
      try {
        activeStrudel.hush();
      } catch {
        // If the scheduler cannot stop, mute the master so nothing keeps playing.
        silence(activeStrudel);
      }
    } else silence(activeStrudel, true);
  } else if (initPromise)
    void initPromise
      .then((strudel) => {
        if (!allowed && revision === stoppedAt) silence(strudel);
      })
      .catch(() => {
        /* A failed initialization has no sound to stop. */
      });
}

/** Sample previews share Strudel's context/cache and never evaluate or replace the song. */
export async function listRegisteredSamples() {
  return registeredSamples(await initPlayback());
}
export async function auditionSample(name: string, index = 0, offset = 0) {
  const current = ++previewRevision;
  const runtime = await initPlayback();
  if (current !== previewRevision) throw new DOMException("Preview cancelled", "AbortError");
  return auditionRegisteredSample(runtime, name, index, offset);
}

/** Registers the single callback that receives evaluate() error messages. */
export function onError(callback: ((message: string) => void) | null): void {
  errorCallback = callback;
}

/** Sample downloads that failed or were served from the offline cache. */
export function onAsset(callback: ((message: string) => void) | null): void {
  onMissingSample(callback);
}

/** Passive analyser input from the pinned @strudel/web 1.3.0 master output. */
export function getOutputNode(): { context: AudioContext; node: AudioNode } | null {
  if (!activeStrudel) return null;
  const context = activeStrudel.getAudioContext() as AudioContext;
  const node = activeStrudel.getSuperdoughAudioController()?.output
    ?.destinationGain as AudioNode | null;
  return context && node && typeof node.connect === "function" ? { context, node } : null;
}
