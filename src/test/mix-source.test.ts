import { describe, expect, it } from "vitest";
import { prepareMix, renameTrackPatch } from "@/engine/mix-source";

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

  it("keeps all four parts of a nested, named Strudel stack", () => {
    const source = `samples('github:eddyflux/crate')
setcps(.75)
let chords = chord("<Bbm9 Fm9>/4").dict('ireal')
stack(
  stack( // DRUMS
    s("bd").struct("<[x*<1 2> [~@3 x]] x>"),
    s("~ [rim, sd:<2 3>]").room("<0 .2>")
  ).bank('crate'), // CHORDS
  chords.offset(-1).voicing().s("gm_epiano1:1"), // MELODY
  n("<0!3 1*2>").set(chords).mode("root:g2").voicing().s("gm_acoustic_bass"),
  chords.n("[0 <4 3 <2 5>>*2](<3 5>,8)").anchor("D5").voicing()
).late("[0 .01]*4").size(4)`;
    const mix = prepareMix(source);
    expect(mix.tracks.map((track) => track.name)).toEqual(["DRUMS", "CHORDS", "MELODY", "Track 4"]);
    expect(mix.code.match(/\.orbit\(\d+\)/g)).toEqual([
      ".orbit(64)",
      ".orbit(65)",
      ".orbit(66)",
      ".orbit(67)",
    ]);
    expect(mix.code).toContain('s("gm_epiano1:1")');
    expect(mix.code).toContain('s("gm_acoustic_bass")');
    const rename = renameTrackPatch(source, "DRUMS", "Percussion");
    expect(rename).not.toBeNull();
    const updated = source.slice(0, rename!.from) + rename!.insert + source.slice(rename!.to);
    expect(updated).toContain("stack( // Percussion");
    expect(prepareMix(updated).tracks.map((track) => track.name)).toEqual([
      "Percussion",
      "CHORDS",
      "MELODY",
      "Track 4",
    ]);
  });

  it("renames stack parts by editing or adding a nearby source comment", () => {
    const source = 'stack( // DRUMS\n s("bd"),\n s("hh")\n)';
    const first = renameTrackPatch(source, "DRUMS", "Kick");
    expect(first).not.toBeNull();
    const renamed = source.slice(0, first!.from) + first!.insert + source.slice(first!.to);
    expect(prepareMix(renamed).tracks.map((track) => track.name)).toEqual(["Kick", "Track 2"]);
    const second = renameTrackPatch(renamed, "Track 2", "Hi Hats");
    expect(second).not.toBeNull();
    const result = renamed.slice(0, second!.from) + second!.insert + renamed.slice(second!.to);
    expect(prepareMix(result).tracks.map((track) => track.name)).toEqual(["Kick", "Hi Hats"]);
    expect(result).toContain('s("bd")');
    expect(result).toContain('s("hh")');
    expect(renameTrackPatch(result, "Kick", "Hi Hats")).toBeNull();
  });

  it("renames labeled tracks only with valid JavaScript identifiers", () => {
    const source = 'drums: s("bd");\nhats: s("hh");';
    expect(renameTrackPatch(source, "drums", "Big Drums")).toBeNull();
    const patch = renameTrackPatch(source, "drums", "kick");
    expect(patch).toEqual({ from: 0, to: 5, insert: "kick" });
  });
});
