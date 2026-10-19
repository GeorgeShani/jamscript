import { Compartment, EditorState, Prec, StateEffect, Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { createClient } from "@liveblocks/client";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

import {
  ensureAwarenessUser,
  guardAwarenessIdentity,
  localCursorPresence,
  publishLocalCursor,
  writeAwarenessState,
} from "./cursor-presence";
import { presenceColorFor, readSharedPresence, type SharedPresence } from "./presence";
import { canWrite, createLocalUndo, roomId } from "./shared-document";
import type { CollaborationRole } from "./shared-document";

export type { SharedPresence };

let client: ReturnType<typeof createClient> | null = null;
const bindings = new WeakMap<EditorView, Compartment>();

function liveblocks(
  authEndpoint:
    string | ((room?: string) => Promise<{ token: string }>) = "/api/collaboration/auth",
) {
  client ??= createClient({ authEndpoint });
  return client;
}

function collectRoomPresence(
  awareness: LiveblocksYjsProvider["awareness"],
  others: readonly {
    presence: Record<string, unknown>;
    info?: Record<string, unknown> | undefined;
  }[],
  localClientId: number,
): SharedPresence[] {
  const fromAwareness = readSharedPresence(
    awareness.getStates() as Map<number, Record<string, unknown>>,
    localClientId,
  );
  const byId = new Map(fromAwareness.map((person) => [person.clientId, person]));

  for (const other of others) {
    const clientId = other.presence["__yjs_clientid"];
    if (typeof clientId !== "number") continue;
    const key = String(clientId);
    const existing = byId.get(key);
    const infoName =
      typeof other.info?.["name"] === "string" ? (other.info["name"] as string) : undefined;
    // Ignore role-shaped leftovers from older auth tokens ("owner" / "editor" / "viewer").
    const safeInfo = infoName && !/^(owner|editor|viewer)$/i.test(infoName) ? infoName : undefined;
    const presenceName =
      typeof other.presence["name"] === "string" ? (other.presence["name"] as string) : undefined;
    const presenceUserId =
      typeof other.presence["userId"] === "string"
        ? (other.presence["userId"] as string)
        : undefined;
    const name =
      existing?.name && existing.name !== "Collaborator"
        ? existing.name
        : safeInfo || presenceName || existing?.name || "Collaborator";
    if (existing) {
      byId.set(key, {
        ...existing,
        name,
        id: presenceUserId || existing.id,
      });
      continue;
    }
    if (!safeInfo && !presenceName) continue;
    const seed = presenceUserId || name;
    const palette = presenceColorFor(seed);
    byId.set(key, {
      id: presenceUserId || key,
      clientId: key,
      name,
      color: palette.color,
      track: palette.track,
    });
  }

  return [...byId.values()];
}

/** Align the editor before yCollab observes Y.Text deltas, avoiding duplicate source. */
export function bindSharedEditor(
  view: EditorView,
  doc: Y.Doc,
  awareness: LiveblocksYjsProvider["awareness"] | null,
  role: CollaborationRole,
  undo: Y.UndoManager,
  binding: Compartment,
  identity: { userId: string; name: string } = { userId: "local", name: "Musician" },
) {
  const source = doc.getText("source").toString();
  if (view.state.doc.toString() !== source)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
      annotations: Transaction.addToHistory.of(false),
    });
  const writable = canWrite(role);
  const ytext = doc.getText("source");
  if (awareness) ensureAwarenessUser(awareness, identity);
  view.dispatch({
    effects: binding.reconfigure([
      yCollab(ytext, awareness, { undoManager: writable ? undo : false }),
      awareness ? localCursorPresence(awareness, ytext, identity) : [],
      writable
        ? Prec.highest(keymap.of(yUndoManagerKeymap))
        : [Prec.highest(EditorView.editable.of(false)), EditorState.readOnly.of(true)],
    ]),
  });
  if (awareness) publishLocalCursor(awareness, ytext, view, identity);
}

/** Binds one editor to the shared document. Remote source never starts playback. */
export function attachSharedDocument(
  view: EditorView,
  input: {
    documentId: string;
    role: CollaborationRole;
    userId: string;
    name: string;
    onStatus: (status: string) => void;
    onPresence: (people: SharedPresence[]) => void;
    authEndpoint?: (room?: string) => Promise<{ token: string }>;
  },
) {
  const identity = { userId: input.userId, name: input.name };
  const doc = new Y.Doc();
  const { room, leave } = liveblocks(input.authEndpoint).enterRoom(roomId(input.documentId), {
    // Top-level presence is a fallback when `__yjs.user` blips during reconnect.
    initialPresence: { name: input.name, userId: input.userId },
  });
  const provider = new LiveblocksYjsProvider(room, doc, { offlineSupport_experimental: true });
  const unguard = guardAwarenessIdentity(provider.awareness, identity);
  const undo = createLocalUndo(doc);
  const previous = bindings.get(view);
  const binding = previous ?? new Compartment();
  if (!previous) bindings.set(view, binding);
  view.dispatch({
    effects: previous
      ? binding.reconfigure([EditorView.editable.of(false), EditorState.readOnly.of(true)])
      : StateEffect.appendConfig.of(
          binding.of([EditorView.editable.of(false), EditorState.readOnly.of(true)]),
        ),
  });

  let bound = false;
  const bindWhenReady = () => {
    if (bound || !provider.synced || doc.getMap("meta").get("ready") !== true) return;
    bindSharedEditor(view, doc, provider.awareness, input.role, undo, binding, identity);
    bound = true;
    input.onStatus("connected");
  };
  const meta = doc.getMap("meta");
  meta.observe(bindWhenReady);

  const publishPresence = () => {
    input.onPresence(
      collectRoomPresence(
        provider.awareness,
        room.getOthers() as readonly {
          presence: Record<string, unknown>;
          info?: Record<string, unknown> | undefined;
        }[],
        doc.clientID,
      ),
    );
  };
  provider.awareness.on("change", publishPresence);
  const unsubscribeOthers = room.subscribe("others", publishPresence);
  publishPresence();

  const reassertIdentity = () => {
    writeAwarenessState(provider.awareness, identity);
    if (bound) publishLocalCursor(provider.awareness, doc.getText("source"), view, identity);
  };

  const onRoomStatus = (status: string) => {
    if (status === "connected") reassertIdentity();
    input.onStatus(status === "connected" && bound ? "connected" : status);
  };
  const unsubscribeStatus = room.subscribe("status", onRoomStatus);

  provider.on("sync", (synced: boolean) => {
    if (synced) {
      reassertIdentity();
      bindWhenReady();
    }
    input.onStatus(synced && bound ? "connected" : provider.getStatus());
  });
  bindWhenReady();
  input.onStatus(provider.getStatus());

  return () => {
    unsubscribeStatus();
    unsubscribeOthers();
    meta.unobserve(bindWhenReady);
    provider.awareness.off("change", publishPresence);
    input.onPresence([]);
    if (view.dom.isConnected) view.dispatch({ effects: binding.reconfigure([]) });
    undo.destroy();
    provider.destroy();
    unguard();
    leave();
    doc.destroy();
  };
}
