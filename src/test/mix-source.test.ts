import { describe, expect, it } from "vitest";
import { prepareMix } from "@/engine/mix-source";

describe("playback mix preparation", () => {
  it("routes labeled tracks without editing their source", () => {
    const source = 'setcps(.6);\ndrums: s("bd");\nhats: s("hh").gain(.5);';
    const mix = prepareMix(source);
    expect(mix.tracks.map((track) => track.name)).toEqual(["drums", "hats"]);
    expect(mix.code).toContain('drums: (s("bd")).orbit(64)');
    expect(mix.code).toContain('hats: (s("hh").gain(.5)).orbit(65)');
    expect(source).not.toContain("orbit");
  });

  it("routes a top-level stack, including comments naming its parts", () => {
    const source = 'stack( // DRUMS\n s("bd"), // BASS\n note("c2").s("sawtooth")\n).late(.01)';
    const mix = prepareMix(source);
    expect(mix.tracks.map((track) => track.name)).toEqual(["DRUMS", "BASS"]);
    expect(mix.code).toContain('(s("bd")).orbit(64)');
    expect(mix.code).toContain('(note("c2").s("sawtooth")).orbit(65)');
    expect(mix.code).toContain(").late(.01)");
  });

  it("leaves malformed code untouched", () => {
    const source = 'drums: s("bd"';
    expect(prepareMix(source)).toEqual({ code: source, tracks: [] });
  });
});
