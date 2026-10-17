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
  if (installed || typeof window === "undefined" || !("caches" in window)) return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);
  const cachedFetch = async (input: Parameters<typeof window.fetch>[0], init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.method !== "GET" || !cacheable(request.url)) return nativeFetch(input, init);
    const cache = await caches.open(AUDIO_CACHE);
    try {
      const response = await nativeFetch(input, init);
      if (response.ok) void cache.put(request, response.clone());
      else reportMissing(`Could not load ${fileName(request.url)}. Press Play to retry.`);
      return response;
    } catch (cause) {
      const cached = await cache.match(request);
      if (cached) return cached;
      reportMissing(`Offline and not cached: ${fileName(request.url)}.`);
      throw cause;
    }
  };
  window.fetch = Object.assign(cachedFetch, { preconnect: window.fetch.preconnect });
}

export function onMissingSample(callback: ((detail: string) => void) | null) {
  reportMissing = callback ?? (() => {});
}
