import { beforeEach, describe, expect, it, vi } from "vitest";

const web = vi.hoisted(() => ({
  initStrudel: vi.fn(),
  evaluate: vi.fn(),
  hush: vi.fn(),
  samples: vi.fn(),
  getSuperdoughAudioController: vi.fn().mockReturnValue(null),
  getAudioContext: vi.fn().mockReturnValue(null),
}));
vi.mock("@strudel/web", () => web);
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SSR", false);
  Object.values(web).forEach((fn) => fn.mockReset());
  web.initStrudel.mockResolvedValue(undefined);
  web.evaluate.mockResolvedValue({ pattern: true });
});

describe("Live playback adapter", () => {
  it("reports Strudel's callback-based evaluation errors as failure", async () => {
    const playback = await import("@/engine/playback");
    const errors = vi.fn();
    playback.onError(errors);
    web.evaluate.mockImplementation(async () => {
      const config = web.initStrudel.mock.calls[0]![0] as { onEvalError?: (error: Error) => void };
      config.onEvalError?.(new Error("bad pattern"));
    });
    expect(await playback.play("bad()")).toBe(false);
    expect(errors).toHaveBeenCalledWith("bad pattern");
  });

  it("does not restart audio after Stop interrupts initialization", async () => {
    let finish!: () => void;
    web.initStrudel.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const playback = await import("@/engine/playback");
    const request = playback.play('s("bd")');
    await vi.waitFor(() => expect(web.initStrudel).toHaveBeenCalled());
    const stopped = playback.stop();
    finish();
    await stopped;
    expect(await request).toBe(false);
    expect(web.evaluate).not.toHaveBeenCalled();
    expect(web.hush).toHaveBeenCalled();
  });

  it("allows a later click to retry failed initialization", async () => {
    web.initStrudel.mockRejectedValueOnce(new Error("sounds unavailable"));
    const playback = await import("@/engine/playback");
    expect(await playback.play('s("bd")')).toBe(false);
    expect(await playback.play('s("sd")')).toBe(true);
    expect(web.initStrudel).toHaveBeenCalledTimes(2);
  });

  it("coalesces queued edits to the latest source", async () => {
    const playback = await import("@/engine/playback");
    const first = playback.play('s("bd")');
    const last = playback.play('s("sd")');
    await Promise.all([first, last]);
    expect(web.evaluate).toHaveBeenCalledTimes(1);
    expect(web.evaluate).toHaveBeenCalledWith('s("sd")');
  });

  it("does not let an earlier Stop silence a newer Play request", async () => {
    let finish!: () => void;
    web.initStrudel.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const playback = await import("@/engine/playback");
    const first = playback.play('s("bd")');
    await vi.waitFor(() => expect(web.initStrudel).toHaveBeenCalled());
    const stopped = playback.stop();
    const resumed = playback.play('s("sd")');
    finish();
    await Promise.all([first, stopped, resumed]);
    expect(web.hush).not.toHaveBeenCalled();
    expect(web.evaluate).toHaveBeenCalledWith('s("sd")');
  });

  it("routes solo and levels through Strudel's live orbit and master gains", async () => {
    const gain = () => ({ setTargetAtTime: vi.fn() });
    const master = gain();
    const drums = gain();
    const hats = gain();
    web.getAudioContext.mockReturnValue({ currentTime: 3 });
    web.getSuperdoughAudioController.mockReturnValue({
      output: { destinationGain: { gain: master } },
      nodes: { 64: { output: { gain: drums } }, 65: { output: { gain: hats } } },
    });
    const playback = await import("@/engine/playback");
    playback.setMix({ drums: 0.4, hats: 0.8 }, "drums", 0.5);
    expect(await playback.play('drums: s("bd");\nhats: s("hh");')).toBe(true);
    expect(web.evaluate).toHaveBeenCalledWith(
      'drums: (s("bd")).orbit(64);\nhats: (s("hh")).orbit(65);',
    );
    expect(master.setTargetAtTime).toHaveBeenCalledWith(0.5, 3, 0.015);
    expect(drums.setTargetAtTime).toHaveBeenCalledWith(0.4, 3, 0.015);
    expect(hats.setTargetAtTime).toHaveBeenCalledWith(0, 3, 0.015);
    await playback.stop();
  });
});
