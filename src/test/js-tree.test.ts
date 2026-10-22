import { describe, expect, it, vi } from "vitest";
import { memoizeBySource } from "@/engine/js-tree";
import { deriveMusic } from "@/engine/music-document";
import { readTempo } from "@/features/tempo/tempo";

describe("source memoization", () => {
  it("computes once per distinct source and keeps result identity", () => {
    const compute = vi.fn((source: string) => ({ length: source.length }));
    const memo = memoizeBySource(compute, 2);
    const first = memo("a");
    expect(memo("a")).toBe(first);
    memo("bb");
    memo("ccc");
    expect(compute).toHaveBeenCalledTimes(3);
    memo("a");
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it("shares analysis of the same document between callers", () => {
    const source = ["setcps(0.5)", 's("bd sd").gain(0.8)'].join("\n");
    expect(deriveMusic(source)).toBe(deriveMusic(source));
    expect(readTempo(source)).toBe(readTempo(source));
  });
});
