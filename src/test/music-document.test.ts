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
    const cutoff = model.tracks[0].lenses.find((lens) => lens.id === "bass/param/lpf");
    expect(cutoff?.kind).toBe("param");
    expect(cutoff && source.slice(cutoff.from, cutoff.to)).toBe("800");
  });

  it("rewrites only the intended numeric argument, keeping identical values and comments intact", () => {
    const source = 'setcps(0.6);\nhats: s("hh hh").gain(0.6); // keep 0.6';
    expect(edit(source, { target: "hats/param/gain", value: 0.75 })).toBe('setcps(0.6);\nhats: s("hh hh").gain(0.75); // keep 0.6');
  });

  it("toggles an individual rest without normalizing whitespace or other tracks", () => {
    const source = "drums: s('bd   ~\tsd ~');\nhats: s(\"hh hh\");";
    expect(edit(source, { target: "drums/rhythm", step: 1 })).toBe("drums: s('bd   bd\tsd ~');\nhats: s(\"hh hh\");");
    expect(edit(source, { target: "drums/rhythm", step: 2 })).toBe("drums: s('bd   ~\t~ ~');\nhats: s(\"hh hh\");");
  });

  it.each(['<[bd bd] ~ [sd <cp rim>]*2>', 'bd*2 ~', 'bd \\n sd'])('locks unsupported pattern %s without touching it', (pattern) => {
    const source = `perc: s("${pattern}");`;
    const rhythm = deriveMusic(source).tracks[0]?.lenses[0];
    expect(rhythm?.kind).toBe("rhythm");
    expect(rhythm?.kind === "rhythm" && rhythm.locked).toBe(true);
    expect(lensPatch(source, { target: "perc/rhythm", step: 0 })).toBeNull();
  });

  it("keeps arbitrary valid Strudel code editable without inventing lenses", () => {
    expect(deriveMusic('const x = 800; bass: note("c2").lpf(x + 20);').tracks).toEqual([]);
    expect(deriveMusic('drums: s("bd ~").fast(2);').tracks[0]?.lenses[0]?.kind).toBe("rhythm");
    expect(lensPatch('bass: note("c2").lpf(cutoff);', { target: "bass/param/lpf", value: 800 })).toBeNull();
  });

  it("refuses incomplete code, duplicate labels, computed methods and duplicate parameters", () => {
    expect(deriveMusic('drums: s("bd ~"').valid).toBe(false);
    for (const source of ['bass: s("bd"); bass: s("sd");', 'bass: note("c2")["lpf"](800);', 'bass: note("c2").lpf(800).lpf(1200);']) {
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
    expect(edit(source, { target: "claps/param/gain", value: 0.5 })).toBe('\n\nclaps: sound("cp ~ cp ~").gain(0.5);');
    expect(deriveMusic(source).tracks[0].name).toBe("claps");
  });
});
