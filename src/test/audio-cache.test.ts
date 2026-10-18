import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = window.fetch;
const originalCaches = Object.getOwnPropertyDescriptor(window, "caches");

afterEach(() => {
  window.fetch = originalFetch;
  if (originalCaches) Object.defineProperty(window, "caches", originalCaches);
  else Reflect.deleteProperty(window, "caches");
  vi.resetModules();
});

describe("audio asset cache", () => {
  it("loads remote samples when an isolated frame denies CacheStorage", async () => {
    Object.defineProperty(window, "caches", {
      configurable: true,
      get() {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
    const nativeFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    window.fetch = nativeFetch;
    const { installAudioCache } = await import("@/engine/audio-cache");
    installAudioCache();

    const response = await window.fetch(
      "https://raw.githubusercontent.com/eddyflux/crate/main/strudel.json",
    );

    expect(response.ok).toBe(true);
    expect(nativeFetch).toHaveBeenCalledOnce();
  });
});
