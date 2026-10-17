import type { ReviewExample } from "./review-fixtures";

// Immutable presentation fixtures, not captured history or the playing document.
export const EXAMPLE_TAKES = [
  { id: "example-1942", time: "19:42", label: "drums added", dot: "bg-track-1" },
  { id: "example-1943", time: "19:43", label: "hats 4 to 8", dot: "bg-track-2" },
  { id: "example-1944", time: "19:44", label: "bass lpf 1200 to 430", dot: "bg-track-3" },
] as const;

export type ExampleTake = (typeof EXAMPLE_TAKES)[number];
export type TakeFixture =
  | { status: "examples"; takes: readonly ExampleTake[]; currentId: string }
  | { status: "empty" | "loading" | "unavailable" }
  | { status: "auditioning"; time: string };

export const TAKE_FIXTURES = {
  examples: { status: "examples", takes: EXAMPLE_TAKES, currentId: "example-1944" },
  empty: { status: "empty" },
  loading: { status: "loading" },
  unavailable: { status: "unavailable" },
  auditioning: { status: "auditioning", time: "19:43" },
} as const satisfies Record<string, TakeFixture>;

const BASS_LINES = [
  { kind: "-", text: 'bass: note("c2 ~ eb2 g1").s("sawtooth").lpf(1200).room(0.2);' },
  { kind: "+", text: 'bass: note("c2 ~ eb2 g1").s("sawtooth").lpf(430).room(0.2);' },
] as const;

// Literal example rows only; no comparison algorithm, source reads or edits.
export const TAKE_COMPARISONS: Readonly<Record<ExampleTake["id"], ReviewExample>> = {
  "example-1942": {
    kind: "take", title: "Take comparison",
    comparison: { selected: "19:42, drums added", current: "19:44, bass lpf 1200 to 430" },
    summary: "Synthetic examples, not a comparison with the playing song.",
    lines: [
      { kind: "-", text: 'hats: s("hh hh hh hh").gain(0.6);' },
      { kind: "+", text: 'hats: s("hh hh hh hh hh hh hh hh").gain(0.6);' },
      ...BASS_LINES,
    ],
  },
  "example-1943": {
    kind: "take", title: "Take comparison",
    comparison: { selected: "19:43, hats 4 to 8", current: "19:44, bass lpf 1200 to 430" },
    summary: "Synthetic examples, not a comparison with the playing song.", lines: BASS_LINES,
  },
  "example-1944": {
    kind: "take", title: "Take comparison",
    comparison: { selected: "19:44, bass lpf 1200 to 430", current: "19:44, bass lpf 1200 to 430" },
    summary: "The selected and current examples are the same. No example differences.", lines: [],
  },
};