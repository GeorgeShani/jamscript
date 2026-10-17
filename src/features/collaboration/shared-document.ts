import * as Y from "yjs";

export type CollaborationRole = "owner" | "editor" | "viewer";

const ROOM_PREFIX = "jamscript:";

export function roomId(documentId: string) {
  return `${ROOM_PREFIX}${documentId}`;
}

export function documentIdFromRoom(room: string) {
  if (!room.startsWith(ROOM_PREFIX)) return null;
  const id = room.slice(ROOM_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : null;
}

export function canWrite(role: CollaborationRole) {
  return role === "owner" || role === "editor";
}

/** One local editing origin. Remote updates use a different origin, so undo leaves them in place. */
export const localEditOrigin = Symbol("jamscript-local-edit");

/**
 * Inserts the initial source once. A document that already carries the ready
 * flag, including one copied from another client, is left unchanged.
 */
export function seedSharedText(doc: Y.Doc, source: string) {
  let seeded = false;
  doc.transact(() => {
    const meta = doc.getMap("meta");
    if (meta.get("ready") === true) return;
    meta.set("ready", true);
    const text = doc.getText("source");
    if (text.length === 0 && source) text.insert(0, source);
    seeded = true;
  }, localEditOrigin);
  return seeded;
}

export function sharedSource(doc: Y.Doc) {
  return doc.getText("source").toString();
}

export function createLocalUndo(doc: Y.Doc) {
  return new Y.UndoManager(doc.getText("source"), { trackedOrigins: new Set([localEditOrigin]) });
}
