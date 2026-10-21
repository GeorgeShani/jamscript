import { afterEach, describe, expect, it, vi } from "vitest";
import {
  auditionRegisteredSample,
  registeredSamples,
  stopSamplePreview,
  setSamplePreviewVolume,
} from "@/engine/sample-preview";

function runtime() {
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
    addEventListener: vi.fn(),
  };
  const context = {
    resume: vi.fn(),
    destination: {},
    currentTime: 2,
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
  };
  const gain = {
    gain: { value: 1, setTargetAtTime: vi.fn() },
    context,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const bank = { data: { type: "sample", samples: ["kick.wav"] } };
  const buffer = { duration: 1, getChannelData: () => new Float32Array([0, 0.5, -0.8, 0]) };
  const audio = {
    soundMap: { get: () => ({ bd: bank, sine: { data: { type: "synth" } } }) },
    getSound: vi.fn(() => bank),
    getSampleBuffer: vi.fn().mockResolvedValue({ buffer }),
    getAudioContext: () => context as unknown as AudioContext,
  };
  return { audio, source, gain, context };
}
afterEach(stopSamplePreview);
describe("sample audition bus", () => {
  it("lists real samples and decodes into the same context without evaluating music", async () => {
    const { audio, source, gain } = runtime();
    expect(registeredSamples(audio)).toEqual([{ name: "bd", count: 1 }]);
    const preview = await auditionRegisteredSample(audio, "bd");
    expect(preview.peaks).toHaveLength(256);
    expect(Math.max(...preview.peaks)).toBeCloseTo(0.8);
    expect(source.start).toHaveBeenCalledWith(0, 0);
    expect(source.addEventListener).toHaveBeenCalledWith("ended", expect.any(Function), {
      once: true,
    });
    setSamplePreviewVolume(0.3);
    expect(gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.3, 2, 0.015);
    stopSamplePreview();
    expect(source.stop).toHaveBeenCalled();
    expect(gain.disconnect).toHaveBeenCalled();
  });
  it("does not start a voice when Stop arrives during decoding", async () => {
    const { audio, source } = runtime();
    let release!: (value: unknown) => void;
    audio.getSampleBuffer.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = auditionRegisteredSample(audio, "bd");
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    stopSamplePreview();
    release({ buffer: {} });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(source.start).not.toHaveBeenCalled();
  });
});
