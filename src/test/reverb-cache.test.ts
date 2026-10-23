import { beforeAll, describe, expect, it, vi } from "vitest";

type Convolver = { buffer: unknown };
let createReverb: (this: unknown, ...args: unknown[]) => Convolver;
const createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
  numberOfChannels: channels,
  length,
  sampleRate,
  getChannelData: () => new Float32Array(Math.min(length, 8)),
}));

beforeAll(async () => {
  class FakeContext {
    sampleRate = 48000;
    createBuffer = createBuffer;
    createConvolver() {
      return { buffer: null } as Convolver;
    }
  }
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("BaseAudioContext", FakeContext);
  await import("superdough/reverb.mjs");
  createReverb = (FakeContext.prototype as unknown as { createReverb: typeof createReverb })
    .createReverb;
});

describe("reverb impulse cache", () => {
  it("generates one impulse response for orbits with the same room settings", async () => {
    const context = new (globalThis.AudioContext as unknown as new () => object)();
    // A lowpass start of 0 skips the offline filter pass, keeping the test synchronous.
    const first = createReverb.call(context, 0.001, 0, 0, 0);
    const second = createReverb.call(context, 0.001, 0, 0, 0);
    const other = createReverb.call(context, 0.002, 0, 0, 0);
    await Promise.resolve();
    await Promise.resolve();
    expect(createBuffer).toHaveBeenCalledTimes(2);
    expect(first.buffer).toBeTruthy();
    expect(first.buffer).toBe(second.buffer);
    expect(other.buffer).not.toBe(first.buffer);
  });
});
