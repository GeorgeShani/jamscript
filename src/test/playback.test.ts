import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const web = vi.hoisted(() => ({
  initStrudel: vi.fn(),
  initAudio: vi.fn(),
  evaluate: vi.fn(),
  hush: vi.fn(),
  samples: vi.fn(),
  getSuperdoughAudioController: vi.fn().mockReturnValue(null),
  getAudioContext: vi.fn().mockReturnValue(null),
}));
vi.mock("@strudel/web", () => ({ ...web, Pattern: class MockPattern {} }));
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SSR", false);
  Object.values(web).forEach((fn) => fn.mockReset());
  web.initStrudel.mockResolvedValue(undefined);
  web.initAudio.mockResolvedValue(undefined);
  web.evaluate.mockResolvedValue({ pattern: true });
});

describe("Live playback adapter", () => {
  it("accepts Strudel editor visualization calls without requiring their UI", async () => {
    const playback = await import("@/engine/playback");
    expect(await playback.play('s("bd")._punchcard({ vertical: 0 })._scope()')).toBe(true);
    const { Pattern } = await import("@strudel/web");
    const pattern = new Pattern();
    expect((pattern as { _punchcard: () => unknown })._punchcard()).toBe(pattern);
    expect((pattern as { _scope: () => unknown })._scope()).toBe(pattern);
    await playback.stop();
  });

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
    expect(web.hush).toHaveBeenCalled();
  });

  it("silences a scheduler started by an evaluation that later rejects", async () => {
    const playback = await import("@/engine/playback");
    web.evaluate.mockRejectedValueOnce(new Error("late evaluation failure"));
    expect(await playback.play('s("bd")')).toBe(false);
    expect(web.hush).toHaveBeenCalled();
    expect(await playback.play('s("sd")')).toBe(true);
    await playback.stop();
  });

  it("hard-mutes the output on Stop and restores its level on the next Play", async () => {
    const gain = {
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    };
    web.getAudioContext.mockReturnValue({ currentTime: 3 });
    web.getSuperdoughAudioController.mockReturnValue({
      output: { destinationGain: { gain } },
      nodes: {},
    });
    const playback = await import("@/engine/playback");
    expect(await playback.play('s("bd")')).toBe(true);
    await playback.stop();
    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(3);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 3);
    gain.setTargetAtTime.mockClear();
    playback.setMix({}, null, 0.6);
    expect(gain.setTargetAtTime).not.toHaveBeenCalled();
    expect(await playback.play('s("sd")')).toBe(true);
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(0.6, 3, 0.015);
    await playback.stop();
  });

  it("mutes the master even if Strudel's scheduler stop throws", async () => {
    const gain = {
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    };
    web.getAudioContext.mockReturnValue({ currentTime: 8 });
    web.getSuperdoughAudioController.mockReturnValue({
      output: { destinationGain: { gain } },
    });
    const playback = await import("@/engine/playback");
    expect(await playback.play('s("bd")')).toBe(true);
    web.hush.mockImplementationOnce(() => {
      throw new Error("scheduler failed");
    });
    await playback.stop();
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 8);
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
    await vi.waitFor(() => expect(web.hush).toHaveBeenCalled());
  });

  it("returns from Stop before a stalled initialization finishes", async () => {
    let finish!: () => void;
    web.initStrudel.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const playback = await import("@/engine/playback");
    const playing = playback.play('s("bd")');
    await vi.waitFor(() => expect(web.initStrudel).toHaveBeenCalled());
    await playback.stop();
    expect(web.evaluate).not.toHaveBeenCalled();
    finish();
    expect(await playing).toBe(false);
    await vi.waitFor(() => expect(web.hush).toHaveBeenCalled());
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

  it("hushes a stale evaluation before a newer Play begins", async () => {
    let finish!: () => void;
    web.evaluate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const playback = await import("@/engine/playback");
    const first = playback.play('s("bd")');
    await vi.waitFor(() => expect(web.evaluate).toHaveBeenCalledTimes(1));
    await playback.stop();
    const second = playback.play('s("sd")');
    finish();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(web.hush).toHaveBeenCalled();
    expect(web.evaluate).toHaveBeenLastCalledWith('s("sd")');
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

  it("routes solo, mute and levels through Strudel's live orbit and master gains", async () => {
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
    playback.setMix({ drums: 0.4, hats: 0.8 }, null, 0.5, ["hats"]);
    expect(hats.setTargetAtTime).toHaveBeenLastCalledWith(0, 3, 0.015);
    expect(drums.setTargetAtTime).toHaveBeenLastCalledWith(0.4, 3, 0.015);
    // Levels-only setMix and a live re-evaluate must not clear mute (knob tweaks).
    playback.setMix({ drums: 0.5, hats: 0.8 }, null, 0.5);
    expect(hats.setTargetAtTime).toHaveBeenLastCalledWith(0, 3, 0.015);
    expect(await playback.play('drums: s("bd").lpf(800);\nhats: s("hh");')).toBe(true);
    expect(hats.setTargetAtTime).toHaveBeenLastCalledWith(0, 3, 0.015);
    expect(drums.setTargetAtTime).toHaveBeenLastCalledWith(0.5, 3, 0.015);
    await playback.stop();
  });

  it("evaluates a post-stack-effects song without moving its branches into separate orbits", async () => {
    const playback = await import("@/engine/playback");
    const source = 'stack(s("bd"), s("hh")).room(.5).late(.01)';
    expect(await playback.play(source)).toBe(true);
    expect(web.evaluate).toHaveBeenCalledWith(source);
    await playback.stop();
  });

  it("plays the coastline program with its crate samples and General MIDI parts intact", async () => {
    const playback = await import("@/engine/playback");
    const source = readFileSync("public/fixtures/coastline.strudel", "utf8");
    expect(await playback.play(source)).toBe(true);
    expect(web.evaluate).toHaveBeenCalledWith(source);
    expect(web.initStrudel.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ prebake: expect.any(Function) }),
    );
    await playback.stop();
  });
});
