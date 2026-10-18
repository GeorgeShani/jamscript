import { describe, expect, it } from "vitest";
import { deriveMusic, lensPatch, type LensEdit } from "@/engine/music-document";
import { SAMPLE_CODE } from "@/components/jam/session";

function edit(source: string, action: LensEdit) {
  const patch = lensPatch(source, action);
  expect(patch).not.toBeNull();
  if (!patch) throw new Error("Edit refused");
  return source.slice(0, patch.from) + patch.insert + source.slice(patch.to);
}

describe("Source-derived music controls", () => {
  it("finds real source ranges after comments, newlines and changed values", () => {
    const source = '// a new song\n\nbass:\n note("c2").lpf(800).room(0.4);';
    const model = deriveMusic(source);
    expect(model.valid).toBe(true);
    const cutoff = model.tracks[0]!.lenses.find((lens) => lens.id === "bass/param/lpf");
    expect(cutoff?.kind).toBe("param");
    expect(cutoff && source.slice(cutoff.from, cutoff.to)).toBe("800");
  });

  it("rewrites only the intended numeric argument, keeping identical values and comments intact", () => {
    const source = 'setcps(0.6);\nhats: s("hh hh").gain(0.6); // keep 0.6';
    expect(edit(source, { target: "hats/param/gain", value: 0.75 })).toBe(
      'setcps(0.6);\nhats: s("hh hh").gain(0.75); // keep 0.6',
    );
  });

  it("toggles an individual rest without normalizing whitespace or other tracks", () => {
    const source = "drums: s('bd   ~\tsd ~');\nhats: s(\"hh hh\");";
    expect(edit(source, { target: "drums/rhythm", step: 1 })).toBe(
      "drums: s('bd   bd\tsd ~');\nhats: s(\"hh hh\");",
    );
    expect(edit(source, { target: "drums/rhythm", step: 2 })).toBe(
      "drums: s('bd   ~\t~ ~');\nhats: s(\"hh hh\");",
    );
  });

  it.each(["<[bd bd] ~ [sd <cp rim>]*2>", "bd*2 ~", "bd \\n sd"])(
    "locks unsupported pattern %s without touching it",
    (pattern) => {
      const source = `perc: s("${pattern}");`;
      const rhythm = deriveMusic(source).tracks[0]?.lenses[0];
      expect(rhythm?.kind).toBe("rhythm");
      expect(rhythm?.kind === "rhythm" && rhythm.locked).toBe(true);
      expect(lensPatch(source, { target: "perc/rhythm", step: 0 })).toBeNull();
    },
  );

  it("keeps arbitrary valid Strudel code editable without inventing unsafe lenses", () => {
    const computed = 'const x = 800; bass: note("c2").lpf(x + 20);';
    expect(deriveMusic(computed).tracks[0]?.lenses.map((lens) => lens.kind)).toEqual(["rhythm"]);
    expect(lensPatch(computed, { target: "bass/param/lpf", value: 800 })).toBeNull();
    expect(deriveMusic('drums: s("bd ~").fast(2);').tracks[0]?.lenses[0]?.kind).toBe("rhythm");
    expect(
      lensPatch('bass: note("c2").lpf(cutoff);', { target: "bass/param/lpf", value: 800 }),
    ).toBeNull();
  });

  it("refuses incomplete code, duplicate labels, computed methods and duplicate parameters", () => {
    expect(deriveMusic('drums: s("bd ~"').valid).toBe(false);
    for (const source of [
      'bass: s("bd"); bass: s("sd");',
      'bass: note("c2")["lpf"](800);',
      'bass: note("c2").lpf(800).lpf(1200);',
    ]) {
      expect(lensPatch(source, { target: "bass/param/lpf", value: 900 })).toBeNull();
    }
  });

  it("rejects stale targets, invalid indices and values outside the parameter range", () => {
    for (const value of [NaN, Infinity, -1, 20001]) {
      expect(lensPatch(SAMPLE_CODE, { target: "bass/param/lpf", value })).toBeNull();
    }
    expect(lensPatch(SAMPLE_CODE, { target: "missing/param/lpf", value: 800 })).toBeNull();
    expect(lensPatch(SAMPLE_CODE, { target: "drums/rhythm", step: 999 })).toBeNull();
    expect(lensPatch(SAMPLE_CODE, { target: "drums/rhythm", step: 0.5 })).toBeNull();
  });

  it("tracks new lines and new labeled instruments instead of fixed sample mappings", () => {
    const source = '\n\nclaps: sound("cp ~ cp ~").gain(0.3);';
    expect(edit(source, { target: "claps/param/gain", value: 0.5 })).toBe(
      '\n\nclaps: sound("cp ~ cp ~").gain(0.5);',
    );
    expect(deriveMusic(source).tracks[0]!.name).toBe("claps");
  });

  it("derives safe controls from direct multiline stack tracks and patches only their source", () => {
    const source =
      'setcps(0.5)\nstack(\n  s("bd ~ bd [~ bd]")\n    .gain(0.8),\n  s("~ hh ~ hh")\n    .room(0.2)\n)';
    const model = deriveMusic(source);
    expect(model.tracks.map((track) => track.name)).toEqual(["Track 1", "Track 2"]);
    expect(model.tracks[0]?.lenses.map((lens) => lens.kind)).toEqual(["rhythm", "param"]);
    expect(model.tracks[1]?.lenses.map((lens) => lens.kind)).toEqual(["rhythm", "param"]);
    expect(model.tracks[0]?.lenses[0]?.kind === "rhythm" && model.tracks[0].lenses[0].locked).toBe(
      false,
    );
    const kick = model.tracks[0]?.lenses[0];
    expect(kick?.kind === "rhythm" && kick.steps[3]?.substeps).toEqual([null, "bd"]);
    expect(edit(source, { target: "Track 1/param/gain", value: 0.65 })).toContain(".gain(0.65)");
    expect(edit(source, { target: "Track 1/rhythm", step: 1 })).toContain('s("bd bd bd [~ bd]")');
    expect(edit(source, { target: "Track 2/rhythm", step: 0 })).toContain('s("hh hh ~ hh")');
    expect(edit(source, { target: "Track 2/param/room", value: 0.4 })).toContain(".room(0.4)");
    expect(lensPatch(source, { target: "Track 1/rhythm", step: 3 })).toBeNull();
  });

  it("patches one bracketed substep while preserving spacing and neighboring patterns", () => {
    const source = 'drums: s("bd [~  sd  ~] hh").gain(.5);';
    const rhythm = deriveMusic(source).tracks[0]?.lenses[0];
    expect(rhythm?.kind === "rhythm" && rhythm.steps[1]?.substeps).toEqual([null, "sd", null]);
    expect(edit(source, { target: "drums/rhythm", step: 1, substep: 0 })).toBe(
      'drums: s("bd [bd  sd  ~] hh").gain(.5);',
    );
    expect(edit(source, { target: "drums/rhythm", step: 1, substep: 1 })).toBe(
      'drums: s("bd [~  ~  ~] hh").gain(.5);',
    );
    expect(lensPatch(source, { target: "drums/rhythm", step: 1, substep: 3 })).toBeNull();
    expect(lensPatch(source, { target: "drums/rhythm", step: 0, substep: 0 })).toBeNull();
  });

  it("patches one alternation branch without flattening its cycle or changing neighbors", () => {
    const source = 'drums: s("bd <~  sd  hh> cp").gain(.5);';
    const rhythm = deriveMusic(source).tracks[0]?.lenses[0];
    expect(rhythm?.kind === "rhythm" && rhythm.steps[1]?.alternatives).toEqual([null, "sd", "hh"]);
    expect(edit(source, { target: "drums/rhythm", step: 1, alternative: 0 })).toBe(
      'drums: s("bd <bd  sd  hh> cp").gain(.5);',
    );
    expect(edit(source, { target: "drums/rhythm", step: 1, alternative: 1 })).toBe(
      'drums: s("bd <~  ~  hh> cp").gain(.5);',
    );
    expect(lensPatch(source, { target: "drums/rhythm", step: 1 })).toBeNull();
    expect(lensPatch(source, { target: "drums/rhythm", step: 1, alternative: 3 })).toBeNull();
    expect(
      lensPatch('drums: s("bd <sd [hh cp]> cp")', {
        target: "drums/rhythm",
        step: 1,
        alternative: 0,
      }),
    ).toBeNull();
  });

  it("finds numeric controls in nested stacks and declared pattern chains", () => {
    const source = `let chords = chord("<C F>").dict("ireal");
stack(
  stack(s("bd").gain(.5), s("sd").room(.3)),
  chords.voicing().s("gm_epiano1").room(.6)
)`;
    const model = deriveMusic(source);
    const params = model.tracks
      .flatMap((track) => track.lenses)
      .filter((lens) => lens.kind === "param");
    expect(params.map((lens) => source.slice(lens.from, lens.to))).toEqual([".5", ".3", ".6"]);
    const room = params[2]!;
    const patch = lensPatch(source, { target: room.id, value: 0.7 });
    expect(patch).toMatchObject({ from: room.from, to: room.to, insert: "0.7" });
  });

  it("edits a literal speed operand in a nested chain without changing its neighbors", () => {
    const source = 'stack(s("bd").fast(0.125).gain(.5), s("sd").fast(2));';
    const model = deriveMusic(source);
    const fast = model.tracks[0]?.lenses.find(
      (lens) => lens.kind === "param" && lens.name === "fast",
    );
    expect(fast?.kind).toBe("param");
    expect(edit(source, { target: fast!.id, value: 0.375 })).toBe(
      'stack(s("bd").fast(0.375).gain(.5), s("sd").fast(2));',
    );
    expect(
      lensPatch('bass: s("bd").fast(speed);', { target: "bass/param/fast", value: 2 }),
    ).toBeNull();
  });

  it("identifies repeated numeric methods by occurrence and patches only the selected operand", () => {
    const source = 'bass: s("bd").gain(0.2).gain(0.3).room(0.4);';
    const controls = deriveMusic(source).tracks[0]!.lenses.filter((lens) => lens.kind === "param");
    expect(controls.map((lens) => lens.id)).toEqual([
      "bass/param/gain/0",
      "bass/param/gain/1",
      "bass/param/room",
    ]);
    expect(edit(source, { target: "bass/param/gain/0", value: 0.5 })).toBe(
      'bass: s("bd").gain(0.5).gain(0.3).room(0.4);',
    );
    expect(edit(source, { target: "bass/param/gain/1", value: 0.6 })).toBe(
      'bass: s("bd").gain(0.2).gain(0.6).room(0.4);',
    );
  });

  it("refuses variable chains with reassignment or unrelated receivers", () => {
    const reassigned = 'let chords = chord("C"); chords = other; stack(chords.room(.5), s("bd"));';
    const unrelated = 'const object = { room: x => x }; stack(object.room(.5), s("bd"));';
    for (const source of [reassigned, unrelated]) {
      expect(
        deriveMusic(source)
          .tracks.flatMap((track) => track.lenses)
          .some((lens) => lens.kind === "param" && lens.name === "room"),
      ).toBe(false);
    }
  });

  it("edits simple note and n step grids without flattening unsupported mini-notation", () => {
    const melody = 'bass: note("c2 e2 [g2 ~]").lpf(800);';
    const rhythm = deriveMusic(melody).tracks[0]?.lenses.find((lens) => lens.kind === "rhythm");
    expect(rhythm?.kind === "rhythm" && rhythm.locked).toBe(false);
    expect(rhythm?.kind === "rhythm" && rhythm.steps[2]?.substeps).toEqual(["g2", null]);
    expect(edit(melody, { target: "bass/rhythm", step: 1 })).toBe(
      'bass: note("c2 ~ [g2 ~]").lpf(800);',
    );
    expect(edit(melody, { target: "bass/rhythm", step: 2, substep: 1 })).toBe(
      'bass: note("c2 e2 [g2 c2]").lpf(800);',
    );
    const degrees = 'lead: n("0 2 [4 ~]").s("gm_piano");';
    expect(edit(degrees, { target: "lead/rhythm", step: 0 })).toContain('n("~ 2 [4 ~]")');
    const locked = 'perc: n("[0 <1 3>]*2");';
    expect(deriveMusic(locked).tracks[0]?.lenses[0]).toMatchObject({
      kind: "rhythm",
      locked: true,
    });
    expect(lensPatch(locked, { target: "perc/rhythm", step: 0 })).toBeNull();
  });
});
