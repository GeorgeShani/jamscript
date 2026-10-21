import { describe, expect, it } from "vitest";
import { editorOffsetFromPlayback, prepareMix, renameTrackPatch } from "@/engine/mix-source";

describe("playback mix preparation", () => {
  it.each([
    'drums: s("bd*4").duckorbit("2:3:4");\nbass: s("sine").orbit(2);',
    'stack(s("bd").duck(2), s("sine").orbit(2))',
    'lead: s("sine").orbit("<2 3>");',
    'const routed = p => p.orbit(2);\nlead: routed(s("sine"));',
    'lead: orbit(2, s("sine"));',
  ])("preserves authored orbit routing and duck targets: %s", (source) => {
    const mix = prepareMix(source);
    expect(mix.code).toBe(source);
    expect(mix.mixable).toBe(false);
  });

  it("routes labeled tracks without editing their source", () => {
    const source = 'setcps(.6);\ndrums: s("bd");\nhats: s("hh").gain(.5);';
    const mix = prepareMix(source);
    expect(mix.tracks.map((track) => track.name)).toEqual(["drums", "hats"]);
    expect(mix.code).toContain('drums: (s("bd")).orbit(64)');
    expect(mix.code).toContain('hats: (s("hh").gain(.5)).orbit(65)');
    expect(source).not.toContain("orbit");
  });

  it("returns a labeled song after hoisted track functions without changing editor offsets", () => {
    const source = `let bpm = 120;
setcpm(bpm * .25);
$: stack(trk_0()._punchcard({ vertical: 0 })._scope());
// piano
function trk_0() { return note("c4").sound("gm_piano"); }`;
    const mix = prepareMix(source);
    expect(mix.code).toMatch(/function trk_0\(\).*\n\$: stack\(/);
    expect(mix.code).not.toBe(source);
    expect(mix.tracks).toEqual([]);
    expect(mix.mixable).toBe(false);
    const original = source.indexOf('note("c4")');
    const playback = mix.code.indexOf('note("c4")');
    expect(editorOffsetFromPlayback(playback, mix.tracks, mix.moved)).toBe(original);
    const originalPattern = source.indexOf("stack(");
    const playbackPattern = mix.code.lastIndexOf("stack(");
    expect(editorOffsetFromPlayback(playbackPattern, mix.tracks, mix.moved)).toBe(originalPattern);
  });

  it("preserves original routing when effects follow a named stack", () => {
    const source = 'stack( // DRUMS\n s("bd"), // BASS\n note("c2").s("sawtooth")\n).late(.01)';
    const mix = prepareMix(source);
    expect(mix.tracks.map((track) => track.name)).toEqual(["DRUMS", "BASS"]);
    expect(mix.code).toBe(source);
    expect(mix.mixable).toBe(false);
  });

  it("routes stack branches only when no effects follow the stack", () => {
    const source = 'stack( // DRUMS\n s("bd"), // BASS\n note("c2").s("sawtooth")\n)';
    const mix = prepareMix(source);
    expect(mix.mixable).not.toBe(false);
    expect(mix.code).toContain('(s("bd")).orbit(64)');
    expect(mix.code).toContain('(note("c2").s("sawtooth")).orbit(65)');
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
    expect(mix.code).toBe(source);
    expect(mix.mixable).toBe(false);
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
