import { ChangeSet, Text } from "@codemirror/state";

function difference(before: string, after: string) {
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  let to = before.length;
  let end = after.length;
  while (to > from && end > from && before[to - 1] === after[end - 1]) {
    to--;
    end--;
  }
  return { from, to, insert: after.slice(from, end) };
}

/** Keep typed edits staged while projecting checked control edits onto the last applied program. */
export function createLiveSource(applied: string, editor = applied) {
  let source = applied;
  let staged = ChangeSet.of(difference(applied, editor), applied.length);
  return {
    get source() {
      return source;
    },
    change(before: string, after: string, control: boolean) {
      const patch = difference(before, after);
      const delta = ChangeSet.of(patch, before.length);
      const inverse = staged.invertedDesc;
      if (!control || inverse.touchesRange(patch.from, patch.to)) {
        staged = staged.compose(delta);
        return false;
      }
      const liveChange = delta.map(inverse);
      const text = Text.of(source.split("\n"));
      source = liveChange.apply(text).toString();
      staged = staged.map(liveChange);
      return true;
    },
  };
}
