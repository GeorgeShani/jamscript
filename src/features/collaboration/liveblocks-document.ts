import { Liveblocks } from "@liveblocks/node";
import * as Y from "yjs";

import { roomId, seedSharedText } from "./shared-document";

/** Private rooms; membership is granted through `/api/collaboration/auth`. */
const PRIVATE_ROOM = { defaultAccesses: [] } satisfies Parameters<Liveblocks["getOrCreateRoom"]>[1];

export type SharedFileSource = { id: string; name: string; source: string };

/** Creates the Liveblocks room when missing, then seeds Yjs from the database source. */
export async function seedLiveblocksDocument(
  liveblocks: Liveblocks,
  documentId: string,
  source: string,
) {
  await liveblocks.getOrCreateRoom(roomId(documentId), PRIVATE_ROOM);
  const doc = new Y.Doc();
  seedSharedText(doc, source);
  await liveblocks.sendYjsBinaryUpdate(roomId(documentId), Y.encodeStateAsUpdate(doc));
}

/**
 * Prefer the live Yjs room. If the room was never created or never seeded, heal it
 * from the database copy so owners can reopen projects after a partial Share.
 * Hard Liveblocks failures fall back to the database source so open still works.
 */
export async function readLiveblocksDocument(
  liveblocks: Liveblocks,
  file: SharedFileSource,
): Promise<SharedFileSource> {
  try {
    await liveblocks.getOrCreateRoom(roomId(file.id), PRIVATE_ROOM);
    const update = await liveblocks.getYjsDocumentAsBinaryUpdate(roomId(file.id));
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(update));
    const live = doc.getText("source").toString();
    if (!live && file.source) {
      seedSharedText(doc, file.source);
      await liveblocks.sendYjsBinaryUpdate(roomId(file.id), Y.encodeStateAsUpdate(doc));
      return { id: file.id, name: file.name, source: file.source };
    }
    return { id: file.id, name: file.name, source: live || file.source };
  } catch {
    return { id: file.id, name: file.name, source: file.source };
  }
}

export async function readLiveblocksDocuments(
  liveblocks: Liveblocks,
  files: SharedFileSource[],
): Promise<SharedFileSource[]> {
  return Promise.all(files.map((file) => readLiveblocksDocument(liveblocks, file)));
}
