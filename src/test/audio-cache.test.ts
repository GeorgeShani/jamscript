import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = window.fetch;
const originalCaches = Object.getOwnPropertyDescriptor(window, "caches");

afterEach(() => {
  vi.useRealTimers();
  window.fetch = originalFetch;
  if (originalCaches) Object.defineProperty(window, "caches", originalCaches);
  else Reflect.deleteProperty(window, "caches");
  vi.resetModules();
});

describe("audio asset cache", () => {
  function cacheStorage() {
    const entries = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
      put: vi.fn(async (request: Request, response: Response) => {
        entries.set(request.url, response);
      }),
    };
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: { open: async () => cache },
    });
    return cache;
  }

  it("shares simultaneous downloads and serves cached audio without a network request", async () => {
    cacheStorage();
    const network = vi.fn(async () => new Response(new Uint8Array([1, 2])));
    window.fetch = Object.assign(network, { preconnect: vi.fn() });
    const { installAudioCache } = await import("@/engine/audio-cache");
    installAudioCache();
    const url = "https://raw.githubusercontent.com/eddyflux/crate/main/crate_bd/kick.wav";
    const responses = await Promise.all([window.fetch(url), window.fetch(url)]);
    expect(await responses[0]!.arrayBuffer()).toEqual(await responses[1]!.arrayBuffer());
    expect(network).toHaveBeenCalledOnce();
    await window.fetch(url);
    expect(network).toHaveBeenCalledOnce();
  });

  it("refreshes bank manifests after a minute, and uses the saved map offline", async () => {
    vi.useFakeTimers();
    cacheStorage();
    const network = vi.fn(async () => new Response('{"bd":["kick.wav"]}'));
    window.fetch = Object.assign(network, { preconnect: vi.fn() });
    const { installAudioCache } = await import("@/engine/audio-cache");
    installAudioCache();
    const url = "https://raw.githubusercontent.com/eddyflux/crate/main/strudel.json";
    await window.fetch(url);
    await window.fetch(url);
    expect(network).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_001);
    await window.fetch(url);
    expect(network).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_001);
    network.mockRejectedValue(new TypeError("offline"));
    const response = window.fetch(url);
    await vi.advanceTimersByTimeAsync(251);
    expect(await (await response).json()).toEqual({ bd: ["kick.wav"] });
    expect(network).toHaveBeenCalledTimes(4);
  });

  it("does not cache authenticated, same-origin, or explicitly cancelled requests", async () => {
    const cache = cacheStorage();
    const network = vi.fn(async () => new Response("{}"));
    window.fetch = Object.assign(network, { preconnect: vi.fn() });
    const { installAudioCache } = await import("@/engine/audio-cache");
    installAudioCache();
    await window.fetch(new URL("/private.json", window.location.href));
    await window.fetch("https://example.com/private.json", { credentials: "include" });
    await window.fetch("https://example.com/private.json", {
      headers: { Authorization: "Bearer test" },
    });
    await window.fetch("https://example.com/song.wav", { signal: new AbortController().signal });
    expect(network).toHaveBeenCalledTimes(4);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("does not retain failed manifests and reports the actual HTTP failure", async () => {
    cacheStorage();
    const network = vi.fn(async () => new Response("Not found", { status: 404 }));
    window.fetch = Object.assign(network, { preconnect: vi.fn() });
    const { installAudioCache, onMissingSample } = await import("@/engine/audio-cache");
    const report = vi.fn();
    onMissingSample(report);
    installAudioCache();
    const url = "https://example.com/strudel.json";
    await expect(window.fetch(url)).rejects.toThrow("HTTP 404");
    expect(network).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(expect.stringContaining("HTTP 404"));
    network.mockImplementation(async () => new Response("{}"));
    expect((await window.fetch(url)).ok).toBe(true);
  });

  it("loads remote samples when an isolated frame denies CacheStorage", async () => {
    Object.defineProperty(window, "caches", {
      configurable: true,
      get() {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
    const nativeFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    window.fetch = Object.assign(nativeFetch, { preconnect: vi.fn() });
    const { installAudioCache } = await import("@/engine/audio-cache");
    installAudioCache();

    const response = await window.fetch(
      "https://raw.githubusercontent.com/eddyflux/crate/main/strudel.json",
    );

    expect(response.ok).toBe(true);
    expect(nativeFetch).toHaveBeenCalledOnce();
  });
});
