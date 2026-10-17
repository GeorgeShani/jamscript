import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prepareMix } from "@/engine/mix-source";
import { readTempo } from "@/features/tempo/tempo";
import { deriveMusic, lensPatch } from "@/engine/music-document";

const coastline = readFileSync("public/fixtures/coastline.strudel", "utf8");
const apocalypse = readFileSync("src/fixtures/apocalypse.strudel", "utf8");

describe("coastline compatibility fixture", () => {
  it("keeps the supplied source and its required audio layers intact", () => {
    expect(coastline).toMatch(/^\/\/ "coastline" @by eddyflux\n\/\/ @version 1\.0\n/);
    expect(coastline).toContain("samples('github:eddyflux/crate')");
    expect(coastline).toContain("gm_epiano1:1");
    expect(coastline).toContain("gm_acoustic_bass");
    expect(readTempo(coastline)).toEqual({ cps: 0.75, editable: true });
    const mix = prepareMix(coastline);
    expect(mix.tracks).toHaveLength(4);
    expect(mix.code).toBe(coastline);
    expect(mix.mixable).toBe(false);
    const model = deriveMusic(coastline);
    const drumGain = model.tracks
      .flatMap((track) => track.lenses)
      .find(
        (lens) =>
          lens.kind === "param" &&
          lens.name === "gain" &&
          coastline.slice(lens.from, lens.to) === ".5",
      );
    expect(drumGain).toBeDefined();
    const patch = lensPatch(coastline, { target: drumGain!.id, value: 0.65 });
    expect(patch).toBeTruthy();
    expect(coastline.slice(0, patch!.from) + patch!.insert + coastline.slice(patch!.to)).toContain(
      '.mask("<0 0 1 1>/16").gain(0.65)',
    );
  });
});

describe("Apocalypse comparison source", () => {
  it("retains the 96 BPM expression and the missing GM layers for playback checks", () => {
    expect(readTempo(apocalypse)).toEqual({ cps: 0.4, editable: true });
    for (const sound of ["gm_epiano1", "gm_electric_guitar_clean", "gm_electric_bass_finger"])
      expect(apocalypse).toContain(sound);
    expect(prepareMix(apocalypse).code).toContain("gm_electric_guitar_clean");
    const model = deriveMusic(apocalypse);
    const cutoff = model.tracks
      .flatMap((track) => track.lenses)
      .find(
        (lens) =>
          lens.kind === "param" &&
          lens.name === "lpf" &&
          apocalypse.slice(lens.from, lens.to) === "2200",
      );
    expect(cutoff).toBeDefined();
    expect(lensPatch(apocalypse, { target: cutoff!.id, value: 2400 })).toMatchObject({
      from: cutoff!.from,
      to: cutoff!.to,
      insert: "2400",
    });
  });
});
