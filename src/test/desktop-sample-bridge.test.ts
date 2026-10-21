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
  const { warmPlayback, play, listRegisteredSamples, auditionSample, outputFrames } =
    await import("../../desktop/sandboxed-playback");
  const warming = warmPlayback();
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
    expect(post.mock.calls[0]![0]).toMatchObject({ command: "warm" });
    const warmId = (post.mock.calls[0]![0] as { id: number }).id;
    message({ type: "result", id: warmId, ok: true });
    await warming;
    post.mockClear();
    const playing = play("samples('github:eddyflux/crate'); s('crate_bd')");
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
    post.mockClear();
    const listing = listRegisteredSamples();
    await vi.advanceTimersByTimeAsync(0);
    const listId = (post.mock.calls[0]![0] as { id: number }).id;
    message({ type: "sample-result", id: listId, value: [{ name: "crate_bd", count: 2 }] });
    await expect(listing).resolves.toEqual([{ name: "crate_bd", count: 2 }]);
    const audition = auditionSample("crate_bd", 1);
    await vi.advanceTimersByTimeAsync(0);
    const auditionId = (post.mock.calls.at(-1)![0] as { id: number }).id;
    const preview = {
      name: "crate_bd",
      index: 1,
      duration: 1,
      offset: 0,
      startedAt: Date.now(),
      peaks: new Array(256).fill(0.2),
    };
    message({ type: "sample-result", id: auditionId, value: preview });
    await expect(audition).resolves.toEqual(preview);
    const measured = vi.fn(),
      waveform = vi.fn();
    const offMeter = outputFrames().meter.subscribe(measured),
      offVisual = outputFrames().visual.subscribe(waveform);
    message({
      type: "levels",
      peakDb: -12,
      rmsDb: -18,
      bands: new Array(32).fill(0.4),
      timeDomain: new Array(256).fill(0.2),
    });
    expect(measured.mock.calls.at(-1)?.[0].channels).toHaveLength(1);
    expect(waveform.mock.calls.at(-1)?.[0].timeDomain).toHaveLength(256);
    offMeter();
    offVisual();
  } finally {
    for (const [type, listener] of listeners.mock.calls)
      if (type === "message") window.removeEventListener(type, listener);
    frame.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});
