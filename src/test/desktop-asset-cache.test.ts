import { afterEach, expect, it, vi } from "vitest";

import { canProxyAssetUrl, loadDesktopAsset } from "../../desktop/asset-cache";

afterEach(() => vi.unstubAllGlobals());

it("preserves old cached samples while migrating eviction metadata", async () => {
  const url = "https://raw.githubusercontent.com/eddyflux/crate/main/old-cache.wav";
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("jamscript-desktop-audio", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("assets", { keyPath: "url" });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("assets", "readwrite");
      transaction
        .objectStore("assets")
        .put({ url, bytes: new Uint8Array([9]).buffer, contentType: "audio/wav", savedAt: 1 });
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  const network = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", network);
  expect(new Uint8Array((await loadDesktopAsset(url)).bytes)).toEqual(new Uint8Array([9]));
  expect(network).not.toHaveBeenCalled();
});

it("reuses a downloaded sample when the network is unavailable", async () => {
  const url = `https://raw.githubusercontent.com/eddyflux/crate/main/test-${crypto.randomUUID()}.wav`;
  const network = vi.fn().mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "Content-Type": "audio/wav" },
    }),
  );
  vi.stubGlobal("fetch", network);
  expect(new Uint8Array((await loadDesktopAsset(url)).bytes)).toEqual(new Uint8Array([1, 2, 3]));

  network.mockRejectedValue(new Error("offline"));
  const cached = await loadDesktopAsset(url);
  expect(new Uint8Array(cached.bytes)).toEqual(new Uint8Array([1, 2, 3]));
  expect(cached.contentType).toBe("audio/wav");
});

it("refuses local endpoints and URLs with credentials", () => {
  expect(canProxyAssetUrl("http://localhost:3000/private")).toBe(false);
  expect(canProxyAssetUrl("https://user:pass@raw.githubusercontent.com/file.wav")).toBe(false);
  expect(canProxyAssetUrl("https://raw.githubusercontent.com/file.wav")).toBe(true);
});

it("shares a download but returns independently transferable bytes", async () => {
  const url = `https://raw.githubusercontent.com/eddyflux/crate/main/${crypto.randomUUID()}.wav`;
  const network = vi.fn(async () => new Response(new Uint8Array([4, 5])));
  vi.stubGlobal("fetch", network);
  const [a, b] = await Promise.all([loadDesktopAsset(url), loadDesktopAsset(url)]);
  expect(network).toHaveBeenCalledOnce();
  expect(a.bytes).not.toBe(b.bytes);
  expect(new Uint8Array(b.bytes)).toEqual(new Uint8Array([4, 5]));
  await loadDesktopAsset(url);
  expect(network).toHaveBeenCalledOnce();
});

it("queues bursts instead of dropping sounds after eight downloads", async () => {
  let active = 0;
  let peak = 0;
  const network = vi.fn(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active -= 1;
    return new Response(new Uint8Array([1]));
  });
  vi.stubGlobal("fetch", network);
  const prefix = crypto.randomUUID();
  const results = await Promise.all(
    Array.from({ length: 16 }, (_, i) =>
      loadDesktopAsset(`https://raw.githubusercontent.com/eddyflux/crate/main/${prefix}-${i}.wav`),
    ),
  );
  expect(results).toHaveLength(16);
  expect(network).toHaveBeenCalledTimes(16);
  expect(peak).toBeLessThanOrEqual(8);
});
