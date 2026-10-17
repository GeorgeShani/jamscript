// Thin playback adapter. The ONLY file that imports @strudel/web (AGPL-3.0-or-later,
// licence notices kept intact in node_modules). Everything here is browser-only:
// the library is loaded with a dynamic import so nothing runs on the server or
// at page load. Evaluation is serialized and pending source changes are coalesced.

type StrudelWeb = typeof import("@strudel/web");
import { installAudioCache, onMissingSample } from "./audio-cache";
import { editorOffsetFromPlayback, prepareMix, type MixTrack } from "./mix-source";
import { registerBundledSoundfonts } from "./register-soundfonts";
import type { PlaybackRange } from "@/components/jam/playback-highlights";

let initPromise: Promise<StrudelWeb> | null = null;
let errorCallback: ((message: string) => void) | null = null;
let evaluationError: string | null = null;
let revision = 0;
let allowed = false;
let work: Promise<boolean> = Promise.resolve(false);
let activeStrudel: StrudelWeb | null = null;
let mixTracks: MixTrack[] = [];
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
  const locations = (hap as { context?: { locations?: { start: number; end: number }[] } }).context
    ?.locations;
  if (!locations?.length) return;
  const ranges = locations.flatMap(({ start, end }) => {
    if (miniLocations.size && !miniLocations.has(`${start}:${end}`)) return [];
    const from = editorOffsetFromPlayback(start, mixTracks);
    const to = editorOffsetFromPlayback(end, mixTracks);
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
  if (master) master.setTargetAtTime(masterLevel, context.currentTime, 0.015);
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
  muted: readonly string[] = [],
) {
  mixLevels = levels;
  soloTrack = solo;
  mutedTracks = new Set(muted);
  masterLevel = master;
  applyMix();
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Stop the scheduler and hard-mute its output so long effect tails cannot leak. */
function silence(strudel: StrudelWeb) {
  try {
    const context = strudel.getAudioContext?.() as AudioContext | undefined;
    const gain = strudel.getSuperdoughAudioController?.()?.output?.destinationGain?.gain as
      AudioParam | undefined;
    if (context && gain) {
      gain.cancelScheduledValues?.(context.currentTime);
      gain.setValueAtTime?.(0, context.currentTime);
    }
  } catch {
    // A broken audio graph must not prevent the scheduler from stopping.
  }
  try {
    strudel.hush();
  } catch {
    // The master mute above still prevents output if the scheduler fails.
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
      await strudel.initStrudel({
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
          await registerBundledSoundfonts(strudel);
          // Match the REPL's default banks, including rim and other named drums.
          // These recording assets remain remote until self-hosted with their licences.
          const base = "https://raw.githubusercontent.com/felixroos/dough-samples/main";
          await Promise.all(
            ["tidal-drum-machines", "piano", "Dirt-Samples", "EmuSP12", "vcsl", "mridangam"].map(
              (bank) => strudel.samples(`${base}/${bank}.json`),
            ),
          );
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

/** Evaluates the session code like the Strudel REPL. Never throws: errors go to onError. */
export function play(code: string): Promise<boolean> {
  const request = ++revision;
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
        miniLocations.clear();
        mixTracks = mix.mixable === false ? [] : mix.tracks;
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
          silence(strudel);
          errorCallback?.(evaluationError);
          return false;
        }
        if (mixTimer) clearInterval(mixTimer);
        mixEnabled = true;
        applyMix();
        // Orbits are created lazily on their first note. Keep new nodes in sync.
        mixTimer = setInterval(applyMix, 80);
        return true;
      } catch (error) {
        // evaluate() may start a scheduler before rejecting. Do not let a failed
        // Play leave audio running behind an Idle transport.
        if (strudel) silence(strudel);
        mixEnabled = false;
        if (allowed && request === revision) {
          allowed = false;
          errorCallback?.(message(error));
        }
        return false;
      }
    });
  return work;
}

/** Stops all playing patterns. */
export async function stop(): Promise<void> {
  allowed = false;
  mixEnabled = false;
  clearHighlightTimers();
  if (mixTimer) clearInterval(mixTimer);
  mixTimer = null;
  const stoppedAt = ++revision;
  // Release the transport immediately even if a sample manifest or worklet is
  // still loading. A stale initialization hushes only if no newer Play won.
  if (activeStrudel) silence(activeStrudel);
  else if (initPromise)
    void initPromise
      .then((strudel) => {
        if (!allowed && revision === stoppedAt) silence(strudel);
      })
      .catch(() => {
        /* A failed initialization has no sound to stop. */
      });
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
