// Immutable presentation examples, never comparisons against the current document.
export type ReviewKind = "repo" | "take" | "rework";
export type ReviewCheckStatus = "notChecked" | "passed" | "failed" | "pending" | "unavailable";
export type ReviewCheck = { readonly label: string; readonly status: ReviewCheckStatus };
export interface ReviewExample {
  kind: ReviewKind;
  title: string;
  summary?: string;
  comparison?: { selected: string; current: string };
  lines: readonly { kind: "-" | "+"; text: string }[];
  checks?: readonly ReviewCheck[];
}

const EXAMPLE_LINES = [
  { kind: "-", text: 'bass: note("c2 ~ eb2 g1").s("sawtooth").lpf(1200).room(0.2);' },
  { kind: "+", text: 'bass: note("c2 ~ eb2 g1").s("sawtooth").lpf(430).room(0.2);' },
  { kind: "-", text: 'hats: s("hh hh hh hh").gain(0.6);' },
  { kind: "+", text: 'hats: s("hh hh hh hh hh hh hh hh").gain(0.6);' },
] as const;

export const REVIEW_EXAMPLES: Record<ReviewKind, ReviewExample> = {
  repo: {
    kind: "repo",
    title: "Changes in night-bus.js",
    summary: "bass lpf 1200 to 430, hats 4 to 8 hits",
    lines: EXAMPLE_LINES,
  },
  take: {
    kind: "take",
    title: "Take comparison",
    summary: "bass lpf 1200 to 430, hats 4 to 8 hits",
    lines: EXAMPLE_LINES,
  },
  rework: {
    kind: "rework",
    title: "Example proposal",
    summary: "Example only. No request was sent and no checks were run.",
    lines: EXAMPLE_LINES.slice(2),
    checks: [
      { label: "Parses", status: "notChecked" },
      { label: "Plays", status: "notChecked" },
      { label: "Keeps what you asked", status: "notChecked" },
    ],
  },
};
