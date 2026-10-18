export interface WorkspaceRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentRecord {
  id: string;
  workspaceId: string;
  name: string;
  source: string;
  /** Display interpretation only. Playback continues to use the source CPS. */
  beatsPerCycle?: number;
  mix?: { master: number; levels: Record<string, number>; colors?: Record<string, number> };
  shared?: {
    workspaceId: string;
    documentId: string;
    role: "owner" | "editor" | "viewer";
  };
  createdAt: number;
  updatedAt: number;
}

export interface GitWorkspaceStatus {
  branch: string | null;
  files: { name: string; status: string }[];
  hasOrigin: boolean;
  originUrl: string | null;
}

export interface WorkspaceStorage {
  listWorkspaces: typeof listWorkspaces;
  listDocuments: typeof listDocuments;
  createWorkspace: typeof createWorkspace;
  createDocument: typeof createDocument;
  saveDocument: typeof saveDocument;
  renameDocument: typeof renameDocument;
  renameWorkspace: typeof renameWorkspace;
  deleteDocument: typeof deleteDocument;
  deleteWorkspace: typeof deleteWorkspace;
  /** Desktop-only capabilities. Browser storage deliberately has no native path API. */
  openFolder?: () => Promise<WorkspaceRecord | null>;
  saveToDisk?: (document: DocumentRecord) => Promise<void>;
  saveAs?: (document: DocumentRecord, name: string) => Promise<DocumentRecord>;
  refreshDocument?: (document: DocumentRecord) => Promise<DocumentRefresh>;
  /** Replace the editor with the current disk bytes after a conflict. */
  acceptDisk?: (document: DocumentRecord) => Promise<DocumentRecord>;
  /** Keep the editor buffer and allow the next Save to replace the disk file. */
  keepLocalOverDisk?: (document: DocumentRecord) => Promise<void>;
  /** Desktop folder watcher. Returns an unsubscribe function. */
  watchWorkspace?: (workspaceId: string, onChange: () => void) => Promise<() => void>;
  isNativeWorkspace?: (id: string) => boolean;
  isDirty?: (document: DocumentRecord) => boolean;
  git?: {
    status(workspaceId: string): Promise<GitWorkspaceStatus>;
    initialize(workspaceId: string): Promise<GitWorkspaceStatus>;
    commit(
      workspaceId: string,
      documents: DocumentRecord[],
      deletedNames: string[],
      message: string,
    ): Promise<GitWorkspaceStatus>;
    cloneInto(workspaceId: string, url: string): Promise<GitWorkspaceStatus>;
    setOrigin(workspaceId: string, url: string): Promise<GitWorkspaceStatus>;
    push(workspaceId: string): Promise<GitWorkspaceStatus>;
    pull(workspaceId: string, documents: DocumentRecord[]): Promise<GitWorkspaceStatus>;
    githubAuthStatus(): Promise<{ signedIn: boolean; deviceFlowAvailable: boolean }>;
    beginGitHubDeviceFlow(): Promise<{
      userCode: string;
      verificationUri: string;
      interval: number;
      expiresIn: number;
    }>;
    pollGitHubDeviceFlow(): Promise<{ status: string }>;
    storeGitHubToken(token: string): Promise<{ signedIn: boolean; deviceFlowAvailable: boolean }>;
    signOutGitHub(): Promise<{ signedIn: boolean; deviceFlowAvailable: boolean }>;
  };
}

export interface DocumentRefresh {
  source: string;
  changed: boolean;
  conflict?: { diskSource: string };
}

const DB_NAME = "jamscript-workspaces";
const DB_VERSION = 1;
let databasePromise: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("workspaces", { keyPath: "id" });
        const documents = db.createObjectStore("documents", { keyPath: "id" });
        documents.createIndex("workspaceId", "workspaceId");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
      request.onblocked = () => reject(new Error("Workspace database is open in another tab"));
    }).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise!;
}

async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction, resolve: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? new Error("Workspace database operation failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Workspace database operation aborted"));
    run(tx, (value) => {
      result = value;
    });
  });
}

export function listWorkspaces() {
  return transaction<WorkspaceRecord[]>(["workspaces"], "readonly", (tx, done) => {
    const request = tx.objectStore("workspaces").getAll();
    request.onsuccess = () =>
      done((request.result as WorkspaceRecord[]).sort((a, b) => b.updatedAt - a.updatedAt));
  });
}

export function listDocuments(workspaceId: string) {
  return transaction<DocumentRecord[]>(["documents"], "readonly", (tx, done) => {
    const request = tx.objectStore("documents").index("workspaceId").getAll(workspaceId);
    request.onsuccess = () =>
      done((request.result as DocumentRecord[]).sort((a, b) => a.createdAt - b.createdAt));
  });
}

export function createWorkspace(name: string, templateSource?: string, templateFileName?: string) {
  const now = Date.now();
  const workspace: WorkspaceRecord = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
  };
  const document: DocumentRecord = {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    name: templateFileName ?? (templateSource === undefined ? "untitled.js" : "night-bus.js"),
    source: templateSource ?? "",
    beatsPerCycle: 4,
    createdAt: now,
    updatedAt: now,
  };
  if (!workspace.name) return Promise.reject(new Error("Workspace name is required"));
  return transaction<{ workspace: WorkspaceRecord; document: DocumentRecord }>(
    ["workspaces", "documents"],
    "readwrite",
    (tx, done) => {
      tx.objectStore("workspaces").add(workspace);
      tx.objectStore("documents").add(document);
      done({ workspace, document });
    },
  );
}

export function createDocument(workspaceId: string, name: string) {
  const now = Date.now();
  const document: DocumentRecord = {
    id: crypto.randomUUID(),
    workspaceId,
    name: name.trim(),
    source: "",
    beatsPerCycle: 4,
    createdAt: now,
    updatedAt: now,
  };
  if (!document.name) return Promise.reject(new Error("Document name is required"));
  return transaction<DocumentRecord>(["workspaces", "documents"], "readwrite", (tx, done) => {
    tx.objectStore("documents").add(document);
    const workspace = tx.objectStore("workspaces").get(workspaceId);
    workspace.onsuccess = () => {
      if (workspace.result)
        tx.objectStore("workspaces").put({ ...workspace.result, updatedAt: now });
    };
    done(document);
  });
}

export function saveDocument(document: DocumentRecord) {
  const updated = { ...document, updatedAt: Date.now() };
  return transaction<DocumentRecord>(["documents", "workspaces"], "readwrite", (tx, done) => {
    tx.objectStore("documents").put(updated);
    const workspace = tx.objectStore("workspaces").get(document.workspaceId);
    workspace.onsuccess = () => {
      if (workspace.result)
        tx.objectStore("workspaces").put({ ...workspace.result, updatedAt: updated.updatedAt });
    };
    done(updated);
  });
}

export function renameDocument(document: DocumentRecord, name: string) {
  if (!name.trim()) return Promise.reject(new Error("Document name is required"));
  return saveDocument({ ...document, name: name.trim() });
}

export function deleteDocument(id: string) {
  return transaction<void>(["documents"], "readwrite", (tx, done) => {
    tx.objectStore("documents").delete(id);
    done();
  });
}

export function renameWorkspace(workspace: WorkspaceRecord, name: string) {
  if (!name.trim()) return Promise.reject(new Error("Workspace name is required"));
  const updated = { ...workspace, name: name.trim(), updatedAt: Date.now() };
  return transaction<WorkspaceRecord>(["workspaces"], "readwrite", (tx, done) => {
    tx.objectStore("workspaces").put(updated);
    done(updated);
  });
}

export async function deleteWorkspace(id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["workspaces", "documents"], "readwrite");
    tx.objectStore("workspaces").delete(id);
    const documents = tx
      .objectStore("documents")
      .index("workspaceId")
      .openKeyCursor(IDBKeyRange.only(id));
    documents.onsuccess = () => {
      const cursor = documents.result;
      if (cursor) {
        tx.objectStore("documents").delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Workspace deletion failed"));
  });
}

export const browserStorage: WorkspaceStorage = {
  listWorkspaces,
  listDocuments,
  createWorkspace,
  createDocument,
  saveDocument,
  renameDocument,
  renameWorkspace,
  deleteDocument,
  deleteWorkspace,
};
