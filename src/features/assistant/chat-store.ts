import type { ChatThread } from "./chat-types";

const DATABASE = "jamscript-agent-chats";
const STORE = "threads";
const LIMIT = 30;

let connection: Promise<IDBDatabase> | null = null;

function database() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("workspaceId", "workspaceId");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error("Chat storage unavailable"));
      request.onblocked = () => reject(new Error("Chat storage is open in another tab"));
    }).catch((error: unknown) => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

function stripSecrets(thread: ChatThread): ChatThread {
  return {
    ...thread,
    messages: thread.messages.map(
      ({ id, role, content, createdAt, mode, error, proposal, seenDocumentIds }) => ({
        id,
        role,
        content,
        createdAt,
        ...(mode ? { mode } : {}),
        ...(error ? { error } : {}),
        ...(proposal ? { proposal } : {}),
        ...(seenDocumentIds ? { seenDocumentIds } : {}),
      }),
    ),
  };
}

export async function listChatThreads(workspaceId: string): Promise<ChatThread[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .index("workspaceId")
      .getAll(workspaceId);
    request.onsuccess = () =>
      resolve(
        (request.result as ChatThread[])
          .map(stripSecrets)
          .sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id))
          .slice(0, LIMIT),
      );
    request.onerror = () => reject(request.error ?? new Error("Could not load chats"));
  });
}

export async function saveChatThread(thread: ChatThread): Promise<ChatThread> {
  const db = await database();
  const saved = stripSecrets({ ...thread, updatedAt: Date.now() });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const list = store.index("workspaceId").getAll(thread.workspaceId);
    list.onsuccess = () => {
      const existing = (list.result as ChatThread[])
        .filter((item) => item.id !== saved.id)
        .sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
      store.put(saved);
      for (const old of existing.slice(LIMIT - 1)) store.delete(old.id);
    };
    tx.oncomplete = () => resolve(saved);
    tx.onerror = () => reject(tx.error ?? new Error("Could not save chat"));
  });
}

export async function deleteChatThread(threadId: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(threadId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete chat"));
  });
}

export function trimChatMessages<T>(messages: T[], max = 24): T[] {
  return messages.length <= max ? messages : messages.slice(-max);
}

export function newChatThread(workspaceId: string, title = "New chat"): ChatThread {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    workspaceId,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}
