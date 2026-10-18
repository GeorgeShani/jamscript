const AUDIO_CACHE = "jamscript-audio-v1";
let installed = false;
let reportMissing: (detail: string) => void = () => {};

function cacheable(url: string) {
  return (
    /\.(wav|mp3|ogg|flac|json|sf2)(?:$|\?)/i.test(url) ||
    url.includes("githubusercontent.com") ||
    url.includes("jsdelivr.net") ||
    url.includes("strudel.cc")
  );
}

function fileName(url: string) {
  try {
    return new URL(url).pathname.split("/").pop() || "a sample";
  } catch {
    return "a sample";
  }
}

/** Caches downloaded samples and reports a miss that Play can retry. */
export function installAudioCache() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // An opaque-origin playback frame exposes the property but throws when read.
  let storage: CacheStorage | null = null;
  try {
    storage = window.caches;
  } catch {
    // Remote assets can still load; the frame cannot persist them itself.
  }
  const nativeFetch = window.fetch.bind(window);
  const cachedFetch = async (input: Parameters<typeof window.fetch>[0], init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.method !== "GET" || !cacheable(request.url)) return nativeFetch(input, init);
    let cache: Cache | null = null;
    try {
      cache = storage ? await storage.open(AUDIO_CACHE) : null;
    } catch {
      // Cache access can fail in private browsing or after a storage eviction.
    }
    try {
      const response = await nativeFetch(input, init);
      if (response.ok) {
        if (cache) void cache.put(request, response.clone()).catch(() => {});
      } else reportMissing(`Could not load ${fileName(request.url)}. Press Play to retry.`);
      return response;
    } catch (cause) {
      const cached = await cache?.match(request);
      if (cached) return cached;
      reportMissing(`Offline and not cached: ${fileName(request.url)}.`);
      throw cause;
    }
  };
  window.fetch = cachedFetch;
}

export function onMissingSample(callback: ((detail: string) => void) | null) {
  reportMissing = callback ?? (() => {});
}
