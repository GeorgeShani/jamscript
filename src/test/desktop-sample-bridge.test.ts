import { expect, it, vi } from "vitest";

const assets = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../../desktop/asset-cache", () => ({ loadDesktopAsset: assets.load }));

it("accepts a burst of sample requests from the isolated runtime without dropping the ninth sound", async () => {
  vi.useFakeTimers();
  const listeners = vi.spyOn(window, "addEventListener");
  const releases: (() => void)[] = [];
  assets.load.mockImplementation(
    (url: string) =>
      new Promise((resolve) => {
        releases.push(() =>
          resolve({ url, bytes: new Uint8Array([1]).buffer, contentType: "audio/wav" }),
        );
      }),
  );
  const { play } = await import("../../desktop/sandboxed-playback");
  const playing = play("samples('github:eddyflux/crate'); s('crate_bd')");
  const frame = document.querySelector("iframe")!;
  const post = vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(() => {});
  const message = (data: object) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: frame.contentWindow,
        data: { channel: "jamscript-audio", ...data },
      }),
    );
  try {
    message({ type: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    const request = post.mock.calls[0]![0] as { id: number };
    message({ type: "result", id: request.id, ok: true });
    expect(await playing).toBe(true);
    post.mockClear();
    for (let id = 0; id < 16; id += 1)
      message({
        type: "asset-request",
        id,
        url: `https://raw.githubusercontent.com/eddyflux/crate/main/${id}.wav`,
      });
    expect(assets.load).toHaveBeenCalledTimes(16);
    expect(post).not.toHaveBeenCalled();
    releases.forEach((release) => release());
    await vi.advanceTimersByTimeAsync(0);
    expect(post).toHaveBeenCalledTimes(16);
    expect(post.mock.calls.every(([data]) => (data as { ok: boolean }).ok)).toBe(true);
    post.mockClear();
    for (let id = 0; id < 41; id += 1)
      message({
        type: "asset-request",
        id: id + 100,
        url: "https://raw.githubusercontent.com/eddyflux/crate/main/shared.wav",
      });
    // Executable song code cannot bypass the bridge's bound by reusing a URL.
    expect(assets.load).toHaveBeenCalledTimes(56);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ ok: false, id: 140 }), "*");
    releases.slice(16).forEach((release) => release());
    await vi.advanceTimersByTimeAsync(0);
    expect(post).toHaveBeenCalledTimes(41);
  } finally {
    for (const [type, listener] of listeners.mock.calls)
      if (type === "message") window.removeEventListener(type, listener);
    frame.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});
