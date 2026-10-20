import { beforeEach, describe, expect, it, vi } from "vitest";
import { preloadPatternAssets } from "@/engine/preload-pattern";
import { preloadBundledSoundfont } from "@/engine/register-soundfonts";

vi.mock("@/engine/register-soundfonts", () => ({
  preloadBundledSoundfont: vi.fn().mockResolvedValue(undefined),
}));
const hap = (value: Record<string, unknown>) => ({ value });
const sample = { data: { type: "sample", samples: ["kick.wav", "snare.wav"] } };
const font = { data: { type: "soundfont", fonts: ["piano0", "piano1"] } };
function runtime() {
  return {
    getSound: vi.fn((name: string) => (name.startsWith("gm_") ? font : sample)),
    getSampleInfo: vi.fn((value: Record<string, unknown>) => ({
      url: `${value["s"]}:${value["n"] ?? 0}.wav`,
    })),
    getSampleBuffer: vi.fn().mockResolvedValue({ buffer: {} }),
    getSoundIndex: (index: unknown, count: number) => Number(index ?? 0) % count,
    getAudioContext: () => ({}) as AudioContext,
  };
}
beforeEach(() => vi.clearAllMocks());

describe("cold playback assets", () => {
  it("prepares bank samples and masked GM sections before their first scheduled note", async () => {
    const audio = runtime();
    const pattern = {
      queryArc: vi.fn((begin: number) =>
        begin < 16
          ? [hap({ s: "bd", bank: "crate" })]
          : begin < 32
            ? [hap({ s: "gm_epiano1", n: 1, note: 58 })]
            : [hap({ s: "rd", bank: "crate", n: 2 }), hap({ s: "gm_acoustic_bass", note: 34 })],
      ),
    };
    await preloadPatternAssets(pattern, audio, () => true);
    expect(audio.getSound).toHaveBeenCalledWith("crate_rd");
    expect(audio.getSampleBuffer).toHaveBeenCalledTimes(2);
    expect(preloadBundledSoundfont).toHaveBeenCalledWith(
      "piano1",
      expect.objectContaining({ note: 58 }),
      expect.anything(),
    );
    expect(preloadBundledSoundfont).toHaveBeenCalledWith(
      "piano0",
      expect.objectContaining({ note: 34 }),
      expect.anything(),
    );
    // Replaying uses the same decoder cache, without fetching or making voices again.
    await preloadPatternAssets(pattern, audio, () => true);
    expect(audio.getSampleBuffer).toHaveBeenCalledTimes(2);
    expect(preloadBundledSoundfont).toHaveBeenCalledTimes(2);
  });

  it("waits for all selected buffers and propagates failures rather than starting partially", async () => {
    const audio = runtime();
    audio.getSampleBuffer.mockRejectedValueOnce(new Error("Sample unavailable"));
    const pattern = { queryArc: () => [hap({ s: "bd" })] };
    await expect(preloadPatternAssets(pattern, audio, () => true)).rejects.toThrow(
      "Sample unavailable",
    );
    await preloadPatternAssets(pattern, audio, () => true);
    expect(audio.getSampleBuffer).toHaveBeenCalledTimes(2);
  });

  it("does not continue preparing assets or start after Stop", async () => {
    const audio = runtime();
    let current = true;
    let finish!: () => void;
    audio.getSampleBuffer.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = preloadPatternAssets(
      { queryArc: () => [hap({ s: "bd" })] },
      audio,
      () => current,
    );
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(audio.getSampleBuffer).toHaveBeenCalledOnce());
    current = false;
    finish();
    await rejected;
  });

  it("limits preparation to 128 distinct assets for open-ended patterns", async () => {
    const audio = runtime();
    const pattern = {
      queryArc: (begin: number) =>
        Array.from({ length: 100 }, (_, n) => hap({ s: "bd", n: begin * 100 + n })),
    };
    await preloadPatternAssets(pattern, audio, () => true);
    expect(audio.getSampleBuffer).toHaveBeenCalledTimes(128);
  });

  it("releases a cancelled startup without waiting for a stalled download", async () => {
    const audio = runtime();
    const abort = new AbortController();
    audio.getSampleBuffer.mockReturnValue(new Promise(() => {}));
    const pending = preloadPatternAssets(
      { queryArc: () => [hap({ s: "bd" })] },
      audio,
      () => true,
      abort.signal,
    );
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(audio.getSampleBuffer).toHaveBeenCalledOnce());
    abort.abort();
    await rejected;
  });
});
