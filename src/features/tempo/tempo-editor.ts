import { isolateHistory } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { readTempo, tempoPatch } from "./tempo";

/** Commit through the existing editor history; refuse a stale tempo draft. */
export function changeEditorTempo(view: EditorView, cps: number, expectedCps: number | null) {
  const source = view.state.doc.toString();
  const current = readTempo(source);
  if (!current.editable || current.cps !== expectedCps) return false;
  if (current.cps === cps) return true;
  const patch = tempoPatch(source, cps);
  if (!patch) return false;
  view.dispatch({
    changes: patch,
    annotations: [Transaction.userEvent.of("input.tempo"), isolateHistory.of("full")],
  });
  return true;
}
