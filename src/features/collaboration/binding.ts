import { Compartment, Prec, StateEffect, Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { createClient } from "@liveblocks/client";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

import { canWrite, createLocalUndo, roomId } from "./shared-document";
import type { CollaborationRole } from "./shared-document";

export interface SharedPresence {
  id: string;
  name: string;
}

let client: ReturnType<typeof createClient> | null = null;
const bindings = new WeakMap<EditorView, Compartment>();

function liveblocks() {
  client ??= createClient({ authEndpoint: "/api/collaboration/auth" });
  return client;
}

/** Align the editor before yCollab observes Y.Text deltas, avoiding duplicate source. */
export function bindSharedEditor(
  view: EditorView,
  doc: Y.Doc,
  awareness: LiveblocksYjsProvider["awareness"] | null,
  role: CollaborationRole,
  undo: Y.UndoManager,
  binding: Compartment,
) {
  const source = doc.getText("source").toString();
  if (view.state.doc.toString() !== source)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
      annotations: Transaction.addToHistory.of(false),
    });
  const writable = canWrite(role);
  view.dispatch({
    effects: binding.reconfigure([
      yCollab(doc.getText("source"), awareness, { undoManager: writable ? undo : false }),
      writable
        ? Prec.highest(keymap.of(yUndoManagerKeymap))
        : Prec.highest(EditorView.editable.of(false)),
    ]),
  });
}

/** Binds one editor to the shared document. Remote source never starts playback. */
export function attachSharedDocument(
  view: EditorView,
  input: {
    documentId: string;
    role: CollaborationRole;
    name: string;
    onStatus: (status: string) => void;
    onPresence: (people: SharedPresence[]) => void;
  },
) {
  const doc = new Y.Doc();
  const { room, leave } = liveblocks().enterRoom(roomId(input.documentId), {
    initialPresence: { name: input.name },
  });
  const provider = new LiveblocksYjsProvider(room, doc, { offlineSupport_experimental: true });
  const undo = createLocalUndo(doc);
  const previous = bindings.get(view);
  const binding = previous ?? new Compartment();
  if (!previous) bindings.set(view, binding);
  view.dispatch({
    effects: previous
      ? binding.reconfigure(EditorView.editable.of(false))
      : StateEffect.appendConfig.of(binding.of(EditorView.editable.of(false))),
  });

  let bound = false;
  const bindWhenReady = () => {
    if (bound || !provider.synced || doc.getMap("meta").get("ready") !== true) return;
    bindSharedEditor(view, doc, provider.awareness, input.role, undo, binding);
    bound = true;
    input.onStatus("connected");
  };
  const meta = doc.getMap("meta");
  meta.observe(bindWhenReady);

  const publishPresence = () => {
    const people: SharedPresence[] = [];
    provider.awareness.getStates().forEach((state, clientId) => {
      if (clientId === doc.clientID) return;
      const person = state as { user?: { name?: string }; name?: string };
      const name = person.user?.name || person.name;
      people.push({ id: String(clientId), name: name || "Collaborator" });
    });
    input.onPresence(people);
  };
  provider.awareness.on("change", publishPresence);
  provider.on("sync", (synced: boolean) => {
    if (synced) bindWhenReady();
    input.onStatus(synced && bound ? "connected" : provider.getStatus());
  });
  bindWhenReady();
  input.onStatus(provider.getStatus());

  return () => {
    meta.unobserve(bindWhenReady);
    provider.awareness.off("change", publishPresence);
    if (view.dom.isConnected) view.dispatch({ effects: binding.reconfigure([]) });
    undo.destroy();
    provider.destroy();
    leave();
    doc.destroy();
  };
}
