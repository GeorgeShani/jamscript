// Thin playback adapter. The ONLY file that imports @strudel/web (AGPL-3.0-or-later,
// licence notices kept intact in node_modules). Everything here is browser-only:
// the library is loaded with a dynamic import so nothing runs on the server or
// at page load. Evaluation is serialized and pending source changes are coalesced.

type StrudelWeb = typeof import("@strudel/web");

let initPromise: Promise<StrudelWeb> | null = null;
let errorCallback: ((message: string) => void) | null = null;
let evaluationError: string | null = null;
let revision = 0;
let allowed = false;
let work: Promise<boolean> = Promise.resolve(false);
let activeStrudel: StrudelWeb | null = null;

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Loads @strudel/web and prebakes the drum samples once. Later calls return the same promise. */
export function initPlayback(): Promise<StrudelWeb> {
  if (!initPromise) {
    initPromise = (async () => {
      // The SSR branch is dead-code-eliminated in the client build and vice versa,
      // so the server bundle never contains (or evaluates) the Strudel chunk.
      if (import.meta.env.SSR) throw new Error("playback is browser-only");
      const strudel = await import("@strudel/web");
      await strudel.initStrudel({
        onEvalError: (error: unknown) => {
          evaluationError = message(error);
        },
        // Temporary: loads drum sounds from GitHub. Replaced by self-hosted samples before submission.
        prebake: () => strudel.samples("github:tidalcycles/dirt-samples"),
      });
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
  work = work.then(async () => {
    if (!allowed || request !== revision) return false;
    try {
      const strudel = await initPlayback();
      if (!allowed || request !== revision) return false;
      evaluationError = null;
      await strudel.evaluate(code);
      if (!allowed) {
        strudel.hush();
        return false;
      }
      if (request !== revision) return false;
      if (evaluationError) {
        errorCallback?.(evaluationError);
        return false;
      }
      return true;
    } catch (error) {
      if (allowed && request === revision) errorCallback?.(message(error));
      return false;
    }
  });
  return work;
}

/** Stops all playing patterns. */
export async function stop(): Promise<void> {
  allowed = false;
  const stoppedAt = ++revision;
  await work;
  if (allowed || revision !== stoppedAt) return;
  if (initPromise) {
    try {
      (await initPromise).hush();
    } catch {
      /* A failed initialization has no sound to stop. */
    }
  }
}

/** Registers the single callback that receives evaluate() error messages. */
export function onError(callback: ((message: string) => void) | null): void {
  errorCallback = callback;
}

/** Passive analyser input from the pinned @strudel/web 1.3.0 master output. */
export function getOutputNode(): { context: AudioContext; node: AudioNode } | null {
  if (!activeStrudel) return null;
  const context = activeStrudel.getAudioContext() as AudioContext;
  const node = activeStrudel.getSuperdoughAudioController()?.output
    ?.destinationGain as AudioNode | null;
  return context && node && typeof node.connect === "function" ? { context, node } : null;
}
