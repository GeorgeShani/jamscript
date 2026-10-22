import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

export interface PlaybackRange {
  from: number;
  to: number;
}

type HighlightChange =
  | { type: "add"; id: number; ranges: PlaybackRange[] }
  | { type: "remove"; id: number }
  | { type: "clear" };

const highlightChange = StateEffect.define<HighlightChange>();
let nextId = 0;
const timers = new WeakMap<EditorView, Set<ReturnType<typeof setTimeout>>>();

const activeHighlights = StateField.define<Map<number, PlaybackRange[]>>({
  create: () => new Map(),
  update(active, transaction) {
    // Source locations from an earlier evaluation are not valid after an edit.
    if (transaction.docChanged) return new Map();
    for (const effect of transaction.effects) {
      if (!effect.is(highlightChange)) continue;
      if (effect.value.type === "clear") active = new Map();
      else if (effect.value.type === "add")
        active = new Map(active).set(effect.value.id, effect.value.ranges);
      else {
        active = new Map(active);
        active.delete(effect.value.id);
      }
    }
    return active;
  },
});

const marks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(current, transaction) {
    if (
      !transaction.docChanged &&
      !transaction.effects.some((effect) => effect.is(highlightChange))
    )
      return current;
    const ranges = [...transaction.state.field(activeHighlights).values()]
      .flat()
      .filter(
        (range) =>
          range.from >= 0 && range.to <= transaction.state.doc.length && range.from < range.to,
      )
      .map((range) => Decoration.mark({ class: "cm-playback-hit" }).range(range.from, range.to));
    return Decoration.set(ranges, true);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const playbackHighlightExtension = [activeHighlights, marks];

// Dense patterns hit dozens of notes a second. Each editor transaction rebuilds
// the decoration set on the same thread as Strudel's scheduler, so hits that land
// within one batch window share a single add and a single remove transaction.
const BATCH_MS = 50;
const batches = new WeakMap<
  EditorView,
  { ranges: Map<string, PlaybackRange>; timer: ReturnType<typeof setTimeout> }
>();

export function flashPlaybackRanges(view: EditorView, ranges: PlaybackRange[], durationMs = 180) {
  if (!view.dom.isConnected || !ranges.length) return;
  let batch = batches.get(view);
  if (!batch) {
    const pending = timers.get(view) ?? new Set<ReturnType<typeof setTimeout>>();
    timers.set(view, pending);
    const created = {
      ranges: new Map<string, PlaybackRange>(),
      timer: setTimeout(() => {
        pending.delete(created.timer);
        batches.delete(view);
        if (!view.dom.isConnected) return;
        const id = ++nextId;
        view.dispatch({
          effects: highlightChange.of({ type: "add", id, ranges: [...created.ranges.values()] }),
        });
        const expiry = setTimeout(() => {
          pending.delete(expiry);
          if (view.dom.isConnected)
            view.dispatch({ effects: highlightChange.of({ type: "remove", id }) });
        }, durationMs);
        pending.add(expiry);
      }, BATCH_MS),
    };
    pending.add(created.timer);
    batches.set(view, (batch = created));
  }
  for (const range of ranges) batch.ranges.set(`${range.from}:${range.to}`, range);
}

export function clearPlaybackRanges(view: EditorView) {
  for (const timer of timers.get(view) ?? []) clearTimeout(timer);
  timers.delete(view);
  batches.delete(view);
  if (view.dom.isConnected) view.dispatch({ effects: highlightChange.of({ type: "clear" }) });
}
