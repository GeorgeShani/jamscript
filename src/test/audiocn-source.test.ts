import { describe, expect, it } from "vitest";
import { deriveMusic, lensPatch } from "@/engine/music-document";
import { sampleReplacement } from "@/engine/sample-insertion";

describe("audiocn checked source controls", () => {
  it("patches literal pan left/center/right and leaves modulation alone", () => {
    const source = 'drums: s("bd").pan(0.5).gain(.7);';
    const pan = deriveMusic(source).tracks[0]!.lenses.find(
      (lens) => lens.kind === "param" && lens.name === "pan",
    )!;
    for (const value of [0, 0.5, 1]) {
      const patch = lensPatch(source, { target: pan.id, value });
      if (value === 0.5) expect(patch).toBeNull();
      else
        expect(source.slice(0, patch!.from) + patch!.insert + source.slice(patch!.to)).toBe(
          source.replace("pan(0.5)", `pan(${value})`),
        );
    }
    expect(
      deriveMusic('s("bd").pan(sine)')
        .tracks.flatMap((track) => track.lenses)
        .some((lens) => lens.kind === "param" && lens.name === "pan"),
    ).toBe(false);
  });
  it("replaces only a selected single sound and rejects unsafe sample insertion", () => {
    const source = 'drums: s("bd").gain(.7);';
    expect(sampleReplacement(source, source.indexOf("bd") + 1, "crate_sd", 2)).toEqual({
      from: source.indexOf("bd"),
      to: source.indexOf("bd") + 2,
      insert: "crate_sd:2",
    });
    for (const source of [
      's("bd sd")',
      's("bd").bank("crate")',
      'stack(s("bd")).bank("crate")',
      's("bd", "sd")',
      'samples("bd")',
      "s(name)",
    ])
      expect(sampleReplacement(source, source.indexOf("bd") + 1, "crate_sd", 0)).toBeNull();
  });
});
