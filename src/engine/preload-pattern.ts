import { preloadBundledSoundfont } from "./register-soundfonts";

type Controls = Record<string, unknown>;
export type PreloadPattern = { queryArc: (begin: number, end: number) => { value: unknown }[] };
type SampleRuntime = {
  getSound: (
    name: string,
  ) => { data?: { type?: string; samples?: unknown; fonts?: string[] } } | undefined;
  getSampleInfo: (value: Controls, samples: unknown) => { url: string };
  getSampleBuffer: (value: Controls, samples: unknown) => Promise<unknown>;
  getSoundIndex: (index: unknown, length: number) => number;
  getAudioContext: () => AudioContext;
};

const warmed = new WeakMap<object, Map<string, Promise<unknown>>>();

async function waitForAsset(pending: Promise<unknown>, signal?: AbortSignal) {
  if (!signal) return pending;
  signal.throwIfAborted();
  let abort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([pending, cancelled]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

/** Decode upcoming assets without triggering notes or advancing the scheduler. */
export async function preloadPatternAssets(
  pattern: PreloadPattern,
  runtime: SampleRuntime,
  current: () => boolean,
  signal?: AbortSignal,
) {
  let cache = warmed.get(runtime);
  if (!cache) warmed.set(runtime, (cache = new Map()));
  const jobs = new Map<string, () => Promise<unknown>>();
  const check = () => {
    signal?.throwIfAborted();
    if (!current()) throw new DOMException("Playback cancelled", "AbortError");
  };
  // Include delayed sections such as Coastline's 16/32-cycle masks. Keep
  // arbitrary user programs bounded; later unseen assets still load normally.
  for (let cycle = 0; cycle < 64 && jobs.size < 128; cycle++) {
    check();
    for (const hap of pattern.queryArc(cycle, cycle + 1).slice(0, 2048)) {
      if (!hap.value || typeof hap.value !== "object") continue;
      const value = hap.value as Controls;
      if (typeof value["s"] !== "string") continue;
      const name = value["bank"] ? `${value["bank"]}_${value["s"]}` : value["s"];
      const data = runtime.getSound(name)?.data;
      if (data?.type === "sample" && data.samples) {
        const key = `sample:${runtime.getSampleInfo(value, data.samples).url}`;
        if (!jobs.has(key)) jobs.set(key, () => runtime.getSampleBuffer(value, data.samples));
      } else if (data?.type === "soundfont" && data.fonts?.length) {
        const font = data.fonts[runtime.getSoundIndex(value["n"], data.fonts.length)];
        if (font) {
          const key = `font:${font}:${value["freq"] ?? value["note"] ?? "c3"}`;
          if (!jobs.has(key))
            jobs.set(key, () => preloadBundledSoundfont(font, value, runtime.getAudioContext()));
        }
      }
      if (jobs.size >= 128) break;
    }
    if (cycle % 8 === 7) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  const queue = [...jobs.entries()];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (next < queue.length) {
        check();
        const [key, load] = queue[next++]!;
        let pending = cache.get(key);
        if (!pending) {
          pending = load().catch((error: unknown) => {
            cache.delete(key);
            throw error;
          });
          cache.set(key, pending);
        }
        await waitForAsset(pending, signal);
      }
    }),
  );
  check();
}
