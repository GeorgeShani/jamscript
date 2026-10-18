/** Successful local evaluations only. Takes are private to this device. */
import { takeLabel } from "./take-label";

export interface TakeRecord {
  id: string;
  documentId: string;
  source: string;
  createdAt: number;
  label?: string;
}

const DATABASE = "jamscript-takes";
const LIMIT = 200;
let connection: Promise<IDBDatabase> | null = null;

function database() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const takes = request.result.createObjectStore("takes", { keyPath: "id" });
        takes.createIndex("documentId", "documentId");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error("Take storage unavailable"));
      request.onblocked = () => reject(new Error("Take storage is open in another tab"));
    }).catch((error: unknown) => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

export async function listTakes(documentId: string): Promise<TakeRecord[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("takes", "readonly")
      .objectStore("takes")
      .index("documentId")
      .getAll(documentId);
    request.onsuccess = () =>
      resolve(
        (request.result as TakeRecord[]).sort(
          (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
        ),
      );
    request.onerror = () => reject(request.error ?? new Error("Could not load Takes"));
  });
}

export async function captureTake(documentId: string, source: string): Promise<TakeRecord[]> {
  const db = await database();
  return new Promise<TakeRecord[]>((resolve, reject) => {
    const tx = db.transaction("takes", "readwrite");
    const store = tx.objectStore("takes");
    const request = store.index("documentId").getAll(documentId);
    let result: TakeRecord[] = [];
    request.onsuccess = () => {
      const existing = (request.result as TakeRecord[]).sort(
        (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
      );
      if (existing[0]?.source === source) {
        result = existing;
        return;
      }
      const take: TakeRecord = {
        id: crypto.randomUUID(),
        documentId,
        source,
        createdAt: Math.max(Date.now(), (existing[0]?.createdAt ?? 0) + 1),
        label: takeLabel(existing[0]?.source ?? null, source),
      };
      store.put(take);
      for (const old of existing.slice(LIMIT - 1)) store.delete(old.id);
      result = [take, ...existing.slice(0, LIMIT - 1)];
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? new Error("Could not save Take"));
    tx.onabort = () => reject(tx.error ?? new Error("Take save was aborted"));
  });
}

export async function deleteDocumentTakes(documentId: string): Promise<void> {
  const db = await database();
  const existing = await listTakes(documentId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("takes", "readwrite");
    for (const take of existing) tx.objectStore("takes").delete(take.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete Takes"));
  });
}
