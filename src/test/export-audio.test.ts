import { describe, expect, it } from "vitest";
import { encodeMp3, encodeWav } from "@/engine/export-audio";

const read = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

describe("audio export encoding", () => {
  it("writes stereo PCM WAV with the correct header and samples", async () => {
    const blob = encodeWav({
      sampleRate: 48000,
      left: new Float32Array([1, -1]),
      right: new Float32Array([0.5, 0]),
    });
    const bytes = await read(blob);
    const view = new DataView(bytes);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(16384);
    expect(view.getInt16(48, true)).toBe(-32768);
  });

  it("encodes a real MP3 blob from PCM", async () => {
    const frames = 4608;
    const wave = Float32Array.from({ length: frames }, (_, index) => Math.sin(index / 12) * 0.5);
    const blob = await encodeMp3({ sampleRate: 44100, left: wave, right: wave });
    expect(blob.type).toBe("audio/mpeg");
    expect(blob.size).toBeGreaterThan(100);
    const header = new Uint8Array(await read(blob));
    expect(header.some((byte) => byte !== 0)).toBe(true);
  });
});
