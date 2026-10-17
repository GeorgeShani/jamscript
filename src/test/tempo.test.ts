import { afterEach, describe, expect, it, vi } from "vitest";
import { undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { createMusicEditor, dispatchLensEdit } from "@/components/jam/code-editor";
import { bpmToCps, cpsToBpm, readTempo, tempoPatch } from "@/features/tempo/tempo";
import { changeEditorTempo } from "@/features/tempo/tempo-editor";

const views: EditorView[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  document.body.innerHTML = "";
});

function patched(source: string, cps: number) {
  const patch = tempoPatch(source, cps);
  expect(patch).not.toBeNull();
  return source.slice(0, patch!.from) + patch!.insert + source.slice(patch!.to);
}

describe("BPM and CPS", () => {
  it("converts using an explicit number of beats per cycle", () => {
    expect(bpmToCps(120)).toBe(0.5);
    expect(cpsToBpm(0.75)).toBe(180);
    expect(bpmToCps(90, 3)).toBe(0.5);
    expect(cpsToBpm(0.5, 8)).toBe(240);
    expect(bpmToCps(127.5)).toBe(0.53125);
  });

  it("refuses nonpositive, nonfinite and overflowing values", () => {
    for (const value of [0, -1, NaN, Infinity]) {
      expect(bpmToCps(value)).toBeNull();
      expect(cpsToBpm(value)).toBeNull();
      expect(bpmToCps(120, value)).toBeNull();
    }
    expect(cpsToBpm(Number.MAX_VALUE)).toBeNull();
  });
});

describe("Checked source tempo edits", () => {
  it("reads CPS, CPM and simple BPM-style ratios", () => {
    expect(readTempo('setcps(.75); s("bd")')).toMatchObject({ cps: 0.75, editable: true });
    expect(readTempo('setcpm(120 / 4); s("bd")')).toMatchObject({ cps: 0.5, editable: true });
    expect(readTempo("setcpm(30)")).toMatchObject({ cps: 0.5, editable: true });
    expect(readTempo("setcps(96 / 60 / 4)")).toMatchObject({ cps: 0.4, editable: true });
  });

  it("edits BPM-form tempo without changing its fixed divisors", () => {
    expect(patched("setcps(96 / 60 / 4)", 0.5)).toBe("setcps(120 / 60 / 4)");
  });

  it("changes just the CPS literal and preserves comments and nearby numbers", () => {
    const source = '// 0.6 is also a gain\nsetcps( /* tempo */ 0.6 );\nhats: s("hh").gain(0.6);';
    expect(patched(source, 0.5)).toBe(source.replace("/* tempo */ 0.6", "/* tempo */ 0.5"));
  });

  it("preserves the numerator/divisor form of setcpm", () => {
    const source = 'setcpm(120 /* BPM */ / 4);\ns("bd")';
    expect(patched(source, 140 / 240)).toBe(source.replace("120", "140"));
    expect(patched("setcpm(30)", 0.75)).toBe("setcpm(45)");
  });

  it("can initialize a tempo without changing a directive or a header", () => {
    const source = '// song\n"use strict";\ns("bd")';
    const result = patched(source, 0.5);
    expect(result).toContain('"use strict";');
    expect(result.indexOf('"use strict"')).toBeLessThan(result.indexOf("setcps(0.5)"));
    expect(result).toContain('s("bd")');
    expect(readTempo(result)).toMatchObject({ cps: 0.5, editable: true });
    expect(patched("// empty song", 0.5)).toBe("// empty song\nsetcps(0.5);\n");
  });

  it.each([
    "setcps(rate)",
    "setcps(0.5); setcpm(40)",
    "if (true) setcps(0.5)",
    "const setcps = f; setcps(0.5)",
    "setcps(0.5, 1)",
    "setcps(0)",
    "setcpm(120 / 0)",
    "setcps(96 / 60 / tempoBeats)",
    "setcps(96 / 60 * 4)",
    "setcps(",
  ])("refuses unsupported or ambiguous source: %s", (source) => {
    expect(readTempo(source).editable).toBe(false);
    expect(tempoPatch(source, 0.75)).toBeNull();
  });

  it("shares editor undo with lenses, with one step per tempo commit", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const initial = 'setcps(0.6);\nhats: s("hh").gain(0.6);';
    const view = createMusicEditor(parent, initial, vi.fn(), vi.fn());
    views.push(view);
    dispatchLensEdit(view, { target: "hats/param/gain", value: 0.8 });
    const beforeTempo = view.state.doc.toString();
    expect(changeEditorTempo(view, 0.5, 0.6)).toBe(true);
    expect(view.state.doc.toString()).toContain("setcps(0.5)");
    undo(view);
    expect(view.state.doc.toString()).toBe(beforeTempo);
    undo(view);
    expect(view.state.doc.toString()).toBe(initial);
    expect(changeEditorTempo(view, 0.75, 0.5)).toBe(false);
    expect(view.state.doc.toString()).toBe(initial);
  });
});
