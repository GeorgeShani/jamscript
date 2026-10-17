// Immutable synthetic "Night bus" fixture, also used by working playback.
// Lens maps are presentation examples only; real parsing comes from src/engine later.

export const SAMPLE_CODE = `setcps(0.6);
drums: s("bd ~ sd ~ bd bd sd ~");
hats: s("hh hh hh hh").gain(0.6);
bass: note("c2 ~ eb2 g1").s("sawtooth").lpf(1200).room(0.2);
perc: s("<[bd bd] ~ [sd <cp rim>]*2>");`;

export type LensKey =
  | "drums-rhythm"
  | "hats-rhythm"
  | "hats-gain"
  | "bass-lpf"
  | "bass-room"
  | "perc-rhythm";

/** Synthetic linked-highlight map, not edit ranges: 1-based line, 0-based char range. */
export interface LensSpan {
  line: number;
  start: number;
  end: number;
}

export const LENS_SPANS: Record<LensKey, LensSpan> = {
  "drums-rhythm": { line: 2, start: 9, end: 31 },
  "hats-rhythm": { line: 3, start: 8, end: 21 },
  "hats-gain": { line: 3, start: 28, end: 31 },
  "bass-lpf": { line: 4, start: 44, end: 48 },
  "bass-room": { line: 4, start: 55, end: 58 },
  "perc-rhythm": { line: 5, start: 8, end: 37 },
};

/** Track label -> cable colour token, in code order. */
export const TRACK_RULE: Record<string, string> = {
  drums: "var(--track-1)",
  hats: "var(--track-2)",
  bass: "var(--track-3)",
  perc: "var(--track-4)",
};

export type InlinePanel = "rework" | "diff" | null;
