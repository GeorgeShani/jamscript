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

function applyMix() {
  if (!mixEnabled) return;
  const controller = activeStrudel?.getSuperdoughAudioController?.();
  const context = activeStrudel?.getAudioContext?.() as AudioContext | undefined;
  if (!controller || !context) return;
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
  for (const track of mixTracks) {
    const gain = controller.nodes?.[track.orbit]?.output?.gain as AudioParam | undefined;
    if (!gain) continue;
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
      await strudel.initStrudel({
        editPattern: (pattern: PreloadPattern) => {
          upcoming = pattern;
          // beforeStart only runs on a cold Play. Live edits that introduce new
          // samples would otherwise fetch them when the first note fires, late.
          if (started)
            void preloadPatternAssets(
              pattern,
              strudel,
              () => allowed && started,
              evaluationSignal,
              { waitForAll: false, onBackgroundError: () => {} },
            ).catch(() => {});
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
          // Match the REPL's default banks, including rim and other named drums.
          // These recording assets remain remote until self-hosted with their licences.
          const base = "https://raw.githubusercontent.com/felixroos/dough-samples/main";
          await Promise.all([
            registerBundledSoundfonts(strudel),
            Promise.allSettled(
              ["tidal-drum-machines", "piano", "Dirt-Samples", "EmuSP12", "vcsl", "mridangam"].map(
                (bank) => strudel.samples(`${base}/${bank}.json`),
              ),
            ),
          ]);
        },
      });
      // initStrudel installs a first-mousedown listener, but the first Play
      // click may happen before that listener exists. Load worklets explicitly.
      await strudel.initAudio();
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
        // Orbits are created lazily on their first note. Keep new nodes in sync.
        mixTimer = setInterval(applyMix, 80);
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
