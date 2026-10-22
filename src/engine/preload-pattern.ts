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
  getDefaultValue?: (name: string) => unknown;
  multiChannelOrbits?: boolean;
  getSuperdoughAudioController?: () => {
    getOrbit: (orbit: number, channels: number[]) => unknown;
  } | null;
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
  options: { waitForAll?: boolean; onBackgroundError?: (error: unknown) => void } = {},
) {
  let cache = warmed.get(runtime);
  if (!cache) warmed.set(runtime, (cache = new Map()));
  const jobs = new Map<string, () => Promise<unknown>>();
  const opening = new Set<string>();
  const orbits = new Map<number, number[]>();
  const duckTargets = new Set<number>();
  let yieldedAt = performance.now();
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
      // Superdough creates orbits lazily. A ducking hit can precede the target's
      // first (possibly masked) note, so prepare declared targets without voices.
      const orbit = value["orbit"] ?? runtime.getDefaultValue?.("orbit") ?? 0;
      if (
        typeof orbit === "number" &&
        Number.isSafeInteger(orbit) &&
        orbit >= 0 &&
        orbits.size < 128 &&
        !orbits.has(orbit)
      ) {
        const outputChannels =
          value["channels"] ??
          (runtime.multiChannelOrbits && orbit > 0
            ? [orbit * 2 - 1, orbit * 2]
            : (runtime.getDefaultValue?.("channels") ?? [1, 2]));
        const channels = [outputChannels].flat();
        if (
          channels.length &&
          channels.every(
            (channel) => typeof channel === "number" && Number.isInteger(channel) && channel >= 1,
          )
        )
          orbits.set(
            orbit,
            channels.map((channel) => Number(channel) - 1),
          );
      }
      for (const target of [value["duckorbit"]].flat())
        if (
          typeof target === "number" &&
          Number.isSafeInteger(target) &&
          target >= 0 &&
          duckTargets.size < 128
        )
          duckTargets.add(target);
      if (typeof value["s"] !== "string") continue;
      const name = value["bank"] ? `${value["bank"]}_${value["s"]}` : value["s"];
      const data = runtime.getSound(name)?.data;
      if (data?.type === "sample" && data.samples) {
        const key = `sample:${runtime.getSampleInfo(value, data.samples).url}`;
        if (cycle < 2) opening.add(key);
        if (!jobs.has(key)) jobs.set(key, () => runtime.getSampleBuffer(value, data.samples));
      } else if (data?.type === "soundfont" && data.fonts?.length) {
        const font = data.fonts[runtime.getSoundIndex(value["n"], data.fonts.length)];
        if (font) {
          const key = `font:${font}:${value["freq"] ?? value["note"] ?? "c3"}`;
          if (cycle < 2) opening.add(key);
          if (!jobs.has(key))
            jobs.set(key, () => preloadBundledSoundfont(font, value, runtime.getAudioContext()));
        }
      }
      if (jobs.size >= 128) break;
    }
    // Yield on a time budget so a dense pattern cannot block the scheduler for long.
    if (performance.now() - yieldedAt >= 8) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      yieldedAt = performance.now();
    }
  }
  const loadQueue = async (queue: [string, () => Promise<unknown>][]) => {
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
  };
  const queue = [...jobs.entries()];
  await loadQueue(options.waitForAll === false ? queue.filter(([key]) => opening.has(key)) : queue);
  check();
  const controller = duckTargets.size ? runtime.getSuperdoughAudioController?.() : null;
  for (const target of duckTargets) {
    const channels = orbits.get(target);
    // Do not invent buses for invalid references or change custom output routing.
    if (channels) controller?.getOrbit(target, channels);
  }
  if (options.waitForAll === false)
    void loadQueue(queue.filter(([key]) => !opening.has(key))).catch((error: unknown) => {
      if (current() && !signal?.aborted) options.onBackgroundError?.(error);
    });
}
