import { describe, expect, it } from "vitest";
import { createLiveSource } from "@/workbench/live-source";

describe("applied music and staged typing", () => {
  it("applies controls while keeping unrelated typed edits out of playback", () => {
    const original = 's("bd").gain(0.5)';
    const live = createLiveSource(original);
    const typed = '// draft\ns("sd").gain(0.5)';
    live.change(original, "// draft\n" + original, false);
    live.change("// draft\n" + original, typed, false);
    expect(live.change(typed, typed.replace("0.5", "0.7"), true)).toBe(true);
    expect(live.source).toBe('s("bd").gain(0.7)');
    expect(live.change(typed.replace("0.5", "0.7"), typed.replace("0.5", "0.8"), true)).toBe(true);
    expect(live.source).toBe('s("bd").gain(0.8)');
  });

  it("refuses a control target that was rewritten in unapplied code", () => {
    const original = 's("bd").gain(0.5)';
    const typed = original.replace("0.5", "0.3");
    const live = createLiveSource(original);
    live.change(original, typed, false);
    expect(live.change(typed, typed.replace("0.3", "0.7"), true)).toBe(false);
    expect(live.source).toBe(original);
  });
});
