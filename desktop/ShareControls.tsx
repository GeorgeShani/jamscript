import type { EditorView } from "@codemirror/view";

import type { DocumentRecord } from "@/workspaces/storage";

/** Shared editing stays on the browser companion. Local desktop work needs no account. */
export function SharedProjectList() {
  return null;
}

export function ShareControls(_props: {
  document: DocumentRecord | null;
  onShared: (document: DocumentRecord) => void;
}) {
  return null;
}

export function SharedSession(_props: {
  view: EditorView | null;
  document: DocumentRecord;
  onStatus: (status: string) => void;
  onPresence: (people: { id: string; name: string }[]) => void;
}) {
  return null;
}
