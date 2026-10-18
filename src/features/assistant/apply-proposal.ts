import { isolateHistory } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { ChangeProposal } from "./proposal";

/** Validate every live editor before writing any file in a reviewed proposal. */
export function applyReviewedProposal(
  proposal: ChangeProposal,
  views: Map<string, EditorView>,
  canEdit: (documentId: string) => boolean,
): boolean {
  if (
    !proposal.files.length ||
    new Set(proposal.files.map((file) => file.documentId)).size !== proposal.files.length
  )
    return false;
  const targets = proposal.files.map((file) => ({ file, view: views.get(file.documentId) }));
  if (
    targets.some(
      ({ file, view }) =>
        !view ||
        !view.state.facet(EditorView.editable) ||
        !canEdit(file.documentId) ||
        view.state.doc.toString() !== file.baseSource,
    )
  )
    return false;
  for (const { file, view } of targets) {
    view!.dispatch({
      changes: { from: 0, to: view!.state.doc.length, insert: file.proposedSource },
      annotations: [Transaction.userEvent.of("input.agent-apply"), isolateHistory.of("full")],
    });
  }
  return true;
}
