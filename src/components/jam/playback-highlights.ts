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

export function flashPlaybackRanges(view: EditorView, ranges: PlaybackRange[], durationMs = 180) {
  if (!view.dom.isConnected || !ranges.length) return;
  const id = ++nextId;
  view.dispatch({ effects: highlightChange.of({ type: "add", id, ranges }) });
  const pending = timers.get(view) ?? new Set<ReturnType<typeof setTimeout>>();
  timers.set(view, pending);
  const timer = setTimeout(() => {
    pending.delete(timer);
    if (view.dom.isConnected)
      view.dispatch({ effects: highlightChange.of({ type: "remove", id }) });
  }, durationMs);
  pending.add(timer);
}

export function clearPlaybackRanges(view: EditorView) {
  for (const timer of timers.get(view) ?? []) clearTimeout(timer);
  timers.delete(view);
  if (view.dom.isConnected) view.dispatch({ effects: highlightChange.of({ type: "clear" }) });
}
