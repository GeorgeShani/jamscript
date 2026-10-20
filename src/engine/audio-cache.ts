import { downloadSample, isSampleManifest, MANIFEST_FRESH_MS } from "./sample-download";

const AUDIO_CACHE = "jamscript-audio-v1";
const SAVED_AT = "X-JamScript-Cached-At";
let installed = false;
let reportMissing: (detail: string) => void = () => {};
let isolatedAssetFetch: ((url: string) => Promise<Response | null>) | null = null;

/** Desktop may supply a narrow asset bridge because opaque frames cannot use CacheStorage. */
export function configureIsolatedAssetFetch(fetcher: (url: string) => Promise<Response | null>) {
  isolatedAssetFetch = fetcher;
}

function cacheable(url: string) {
  const { protocol, hostname, pathname } = new URL(url);
  return (
    (protocol === "https:" || protocol === "http:") &&
    (/\.(wav|mp3|ogg|flac|m4a|aif|aiff|opus|json|sf2)$/i.test(pathname) ||
      ["raw.githubusercontent.com", "cdn.jsdelivr.net", "strudel.cc"].includes(hostname))
  );
}

function fileName(url: string) {
  try {
    return new URL(url).pathname.split("/").pop() || "a sample";
  } catch {
    return "a sample";
  }
}

/** Cache public samples without interfering with authenticated app traffic. */
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
  const originalFetch = window.fetch;
  const nativeFetch = originalFetch.bind(window);
  const pending = new Map<string, Promise<Response>>();
  const manifests = new Map<string, { response: Response; savedAt: number }>();
  const cachedFetch = async (input: Parameters<typeof window.fetch>[0], init?: RequestInit) => {
    const request = new Request(input, init);
    // This global hook must never persist API responses or authenticated requests.
    if (
      request.method !== "GET" ||
      !cacheable(request.url) ||
      new URL(request.url).origin === window.location.origin ||
      request.credentials === "include" ||
      !request.headers.keys().next().done ||
      init?.signal ||
      input instanceof Request ||
      request.cache === "no-store" ||
      request.cache === "reload"
    )
      return nativeFetch(input, init);
    const existing = pending.get(request.url);
    if (existing) return (await existing).clone();
    const load = loadAsset(request).finally(() => pending.delete(request.url));
    pending.set(request.url, load);
    return (await load).clone();
  };
  async function loadAsset(request: Request) {
    const manifest = isSampleManifest(request.url);
    const recent = manifests.get(request.url);
    if (manifest && recent && Date.now() - recent.savedAt < MANIFEST_FRESH_MS)
      return recent.response.clone();
    let cache: Cache | null = null;
    let cached: Response | undefined;
    try {
      cache = storage ? await storage.open(AUDIO_CACHE) : null;
      cached = await cache?.match(request);
      if (
        cached &&
        (!manifest || Date.now() - Number(cached.headers.get(SAVED_AT)) < MANIFEST_FRESH_MS)
      )
        return cached;
    } catch {
      // Cache access can fail in private browsing or after a storage eviction.
    }
    try {
      const bridged = !storage && isolatedAssetFetch ? await isolatedAssetFetch(request.url) : null;
      const response =
        bridged ??
        (await downloadSample(
          new Request(request, { credentials: "omit", cache: manifest ? "no-cache" : "default" }),
          nativeFetch,
        ));
      if (manifest) {
        // Bound retained manifest bodies even when private browsing denies storage.
        if (manifests.size >= 32) manifests.delete(manifests.keys().next().value!);
        manifests.set(request.url, { response: response.clone(), savedAt: Date.now() });
      }
      if (cache) {
        const copy = response.clone();
        const headers = new Headers(copy.headers);
        headers.set(SAVED_AT, String(Date.now()));
        await cache
          .put(request, new Response(copy.body, { headers, status: copy.status }))
          .catch(() => {});
      }
      return response;
    } catch (cause) {
      if (cached) return cached;
      reportMissing(
        `Could not load ${fileName(request.url)}. Check the sample URL and connection. ${cause instanceof Error ? cause.message : ""}`,
      );
      throw cause;
    }
  }
  const preconnect = Reflect.get(originalFetch, "preconnect");
  if (typeof preconnect === "function")
    Reflect.set(cachedFetch, "preconnect", preconnect.bind(originalFetch));
  window.fetch = cachedFetch as typeof window.fetch;
}

export function onMissingSample(callback: ((detail: string) => void) | null) {
  reportMissing = callback ?? (() => {});
}
