import { Prec, StateEffect } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { createClient } from "@liveblocks/client";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

import { canWrite, createLocalUndo, roomId, seedSharedText } from "./shared-document";
import type { CollaborationRole } from "./shared-document";

export interface SharedPresence {
  id: string;
  name: string;
}

let client: ReturnType<typeof createClient> | null = null;

function liveblocks() {
  client ??= createClient({ authEndpoint: "/api/collaboration/auth" });
  return client;
}

/** Binds one editor to the shared document. Remote source never starts playback. */
export function attachSharedDocument(
  view: EditorView,
  input: {
    documentId: string;
    role: CollaborationRole;
    initialSource: string;
    onStatus: (status: string) => void;
    onPresence: (people: SharedPresence[]) => void;
  },
) {
  const doc = new Y.Doc();
  const { room, leave } = liveblocks().enterRoom(roomId(input.documentId), {
    initialPresence: { name: input.role },
  });
  const provider = new LiveblocksYjsProvider(room, doc, { offlineSupport_experimental: true });
  const undo = createLocalUndo(doc);
  const writable = canWrite(input.role);
  view.dispatch({
    effects: StateEffect.appendConfig.of([
      yCollab(doc.getText("source"), provider.awareness, { undoManager: writable ? undo : false }),
      writable
        ? Prec.highest(keymap.of(yUndoManagerKeymap))
        : Prec.highest(EditorView.editable.of(false)),
    ]),
  });

  const publishPresence = () => {
    const people: SharedPresence[] = [];
    provider.awareness.getStates().forEach((state, clientId) => {
      if (clientId === doc.clientID) return;
      const name = (state as { user?: { name?: string } }).user?.name;
      people.push({ id: String(clientId), name: name || "Collaborator" });
    });
    input.onPresence(people);
  };
  provider.awareness.on("change", publishPresence);
  provider.on("sync", (synced: boolean) => {
    input.onStatus(synced ? "connected" : provider.getStatus());
    if (synced && writable && input.role === "owner") seedSharedText(doc, input.initialSource);
  });
  input.onStatus(provider.getStatus());

  return () => {
    provider.awareness.off("change", publishPresence);
    provider.destroy();
    leave();
    doc.destroy();
  };
}
