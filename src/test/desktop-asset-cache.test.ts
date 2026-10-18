import { afterEach, expect, it, vi } from "vitest";

import { canProxyAssetUrl, loadDesktopAsset } from "../../desktop/asset-cache";

afterEach(() => vi.unstubAllGlobals());

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
