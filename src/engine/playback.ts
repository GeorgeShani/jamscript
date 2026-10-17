// Thin playback adapter. The ONLY file that imports @strudel/web (AGPL-3.0-or-later,
// licence notices kept intact in node_modules). Everything here is browser-only:
// the library is loaded with a dynamic import so nothing runs on the server or
// at page load. Real session code comes from src/engine later.

type StrudelWeb = typeof import("@strudel/web");

let initPromise: Promise<StrudelWeb> | null = null;
let errorCallback: ((message: string) => void) | null = null;

/** Loads @strudel/web and prebakes the drum samples once. Later calls return the same promise. */
export function initPlayback(): Promise<StrudelWeb> {
  if (!initPromise) {
    initPromise = (async () => {
      // The SSR branch is dead-code-eliminated in the client build and vice versa,
      // so the server bundle never contains (or evaluates) the Strudel chunk.
      if (import.meta.env.SSR) throw new Error("playback is browser-only");
      const strudel = await import("@strudel/web");
      await strudel.initStrudel({
        // Temporary: loads drum sounds from GitHub. Replaced by self-hosted samples before submission.
        prebake: () => strudel.samples("github:tidalcycles/dirt-samples"),
      });
      return strudel;
    })();
  }
  return initPromise;
}

/** Evaluates the session code like the Strudel REPL. Never throws: errors go to onError. */
export async function play(code: string): Promise<boolean> {
  try {
    const strudel = await initPlayback();
    await strudel.evaluate(code);
    return true;
  } catch (err) {
    errorCallback?.(err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Stops all playing patterns. */
export async function stop(): Promise<void> {
  if (!initPromise) return;
  const strudel = await initPromise;
  strudel.hush();
}

/** Registers the single callback that receives evaluate() error messages. */
export function onError(callback: ((message: string) => void) | null): void {
  errorCallback = callback;
}
