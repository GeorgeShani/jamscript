import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import {
  browserStorage,
  type DocumentRecord,
  type DocumentRefresh,
  type WorkspaceRecord,
  type WorkspaceStorage,
} from "../src/workspaces/storage";

type Folder = { id: string; name: string; path: string };
type File = { name: string; source: string; revision: string };

function invoke<T>(command: string, args?: Record<string, unknown>) {
  if (typeof tauriInvoke !== "function")
    throw new Error("Native file access is only available inside the JamScript desktop app");
  return tauriInvoke<T>(command, args);
}
const locations = new Map<string, { folderId: string; name: string }>();
type Baseline = { source: string; revision: string; writeRevision?: string };
const baselines = new Map<string, Baseline>();
const folderId = (id: string) => id.slice("native:".length);
const isNativeWorkspace = (id: string) => id.startsWith("native:");
const recoveryKey = (id: string) => `jamscript-recovery-${id}`;
const idMapKey = (id: string) => `jamscript-file-ids-${id}`;

function ids(id: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(idMapKey(id)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
function saveIds(id: string, value: Record<string, string>) {
  localStorage.setItem(idMapKey(id), JSON.stringify(value));
}
function record(folder: Folder, file: File): DocumentRecord {
  const known = ids(folder.id);
  const stableId = known[file.name] ?? crypto.randomUUID();
  if (!known[file.name]) saveIds(folder.id, { ...known, [file.name]: stableId });
  const id = `native-doc:${stableId}`;
  locations.set(id, { folderId: folder.id, name: file.name });
  const recovery = localStorage.getItem(recoveryKey(id));
  let recovered: {
    source: string;
    baselineSource: string;
    baselineRevision: string;
    writeRevision?: string;
  } | null = null;
  if (recovery) {
    try {
      const parsed: unknown = JSON.parse(recovery);
      if (
        parsed &&
        typeof parsed === "object" &&
        "source" in parsed &&
        "baselineSource" in parsed &&
        "baselineRevision" in parsed &&
        typeof parsed.source === "string" &&
        typeof parsed.baselineSource === "string" &&
        typeof parsed.baselineRevision === "string"
      ) {
        const writeRevision =
          "writeRevision" in parsed && typeof parsed.writeRevision === "string"
            ? parsed.writeRevision
            : undefined;
        recovered = {
          source: parsed.source,
          baselineSource: parsed.baselineSource,
          baselineRevision: parsed.baselineRevision,
          ...(writeRevision ? { writeRevision } : {}),
        };
      }
    } catch {
      /* Ignore a damaged recovery entry. */
    }
  }
  const existing = baselines.get(id);
  if (!existing) {
    baselines.set(
      id,
      recovered
        ? {
            source: recovered.baselineSource,
            revision: recovered.baselineRevision,
            ...(recovered.writeRevision ? { writeRevision: recovered.writeRevision } : {}),
          }
        : { source: file.source, revision: file.revision },
    );
  }
  const now = Date.now();
  return {
    id,
    workspaceId: `native:${folder.id}`,
    name: file.name,
    source: recovered?.source ?? file.source,
    beatsPerCycle: 4,
    createdAt: now,
    updatedAt: now,
  };
}
function location(id: string) {
  const value = locations.get(id);
  if (!value) throw new Error("Native document is no longer open. Reopen its folder.");
  return value;
}
function folderRecord(folder: Folder): WorkspaceRecord {
  return { id: `native:${folder.id}`, name: folder.name, createdAt: 0, updatedAt: 0 };
}
async function getFolder(id: string) {
  const folder = (await invoke<Folder[]>("list_folders")).find((item) => item.id === folderId(id));
  if (!folder) throw new Error("Selected folder is unavailable");
  return folder;
}

export const desktopStorage: WorkspaceStorage = {
  ...browserStorage,
  git: {
    async status(workspaceId) {
      if (!isNativeWorkspace(workspaceId))
        throw new Error("Git is available for desktop folders only");
      return invoke("git_status", { folderId: folderId(workspaceId) });
    },
    async initialize(workspaceId) {
      if (!isNativeWorkspace(workspaceId))
        throw new Error("Git is available for desktop folders only");
      return invoke("git_init", { folderId: folderId(workspaceId) });
    },
    async commit(workspaceId, documents, deletedNames, message) {
      if (!isNativeWorkspace(workspaceId))
        throw new Error("Git is available for desktop folders only");
      const files: { name: string; expectedRevision?: string; deleted: boolean }[] = documents.map(
        (document) => {
          if (document.workspaceId !== workspaceId || desktopStorage.isDirty?.(document))
            throw new Error("Save selected files to disk before committing");
          const baseline = baselines.get(document.id);
          if (!baseline) throw new Error("Reopen the selected folder before committing");
          return { name: document.name, expectedRevision: baseline.revision, deleted: false };
        },
      );
      for (const name of deletedNames) files.push({ name, deleted: true });
      return invoke("git_commit_files", { folderId: folderId(workspaceId), files, message });
    },
    async cloneInto(workspaceId, url) {
      if (!isNativeWorkspace(workspaceId))
        throw new Error("Git is available for desktop folders only");
      return invoke("git_clone", { folderId: folderId(workspaceId), url });
    },
    async push(workspaceId) {
      if (!isNativeWorkspace(workspaceId))
        throw new Error("Git is available for desktop folders only");
      return invoke("git_push", { folderId: folderId(workspaceId) });
    },
    async pull(workspaceId, documents) {
      if (!isNativeWorkspace(workspaceId))
        throw new Error("Git is available for desktop folders only");
      if (
        documents.some(
          (document) => document.workspaceId !== workspaceId || desktopStorage.isDirty?.(document),
        )
      )
        throw new Error("Save all open files before Pull");
      return invoke("git_pull_fast_forward", { folderId: folderId(workspaceId) });
    },
  },
  isNativeWorkspace,
  isDirty(document) {
    return (
      isNativeWorkspace(document.workspaceId) &&
      document.source !== baselines.get(document.id)?.source
    );
  },
  async listWorkspaces() {
    const [local, folders] = await Promise.all([
      browserStorage.listWorkspaces(),
      invoke<Folder[]>("list_folders"),
    ]);
    return [...folders.map(folderRecord), ...local];
  },
  async openFolder() {
    const folder = await invoke<Folder | null>("open_folder");
    return folder ? folderRecord(folder) : null;
  },
  async listDocuments(workspaceId) {
    if (!isNativeWorkspace(workspaceId)) return browserStorage.listDocuments(workspaceId);
    const folder = await getFolder(workspaceId);
    const files = await invoke<File[]>("list_folder_documents", { folderId: folder.id });
    return files.map((file) => record(folder, file));
  },
  async createDocument(workspaceId, name) {
    if (!isNativeWorkspace(workspaceId)) return browserStorage.createDocument(workspaceId, name);
    const folder = await getFolder(workspaceId);
    const file = await invoke<File>("create_folder_document", { folderId: folder.id, name });
    return record(folder, file);
  },
  async saveDocument(document) {
    if (!isNativeWorkspace(document.workspaceId)) return browserStorage.saveDocument(document);
    if (document.source === baselines.get(document.id)?.source)
      localStorage.removeItem(recoveryKey(document.id));
    else {
      const baseline = baselines.get(document.id);
      if (!baseline) throw new Error("Document baseline is unavailable");
      localStorage.setItem(
        recoveryKey(document.id),
        JSON.stringify({
          source: document.source,
          baselineSource: baseline.source,
          baselineRevision: baseline.revision,
          ...(baseline.writeRevision ? { writeRevision: baseline.writeRevision } : {}),
        }),
      );
    }
    return { ...document, updatedAt: Date.now() };
  },
  async saveToDisk(document) {
    const target = location(document.id);
    const baseline = baselines.get(document.id);
    if (!baseline) throw new Error("Document baseline is unavailable");
    const revision = await invoke<string>("write_folder_document", {
      folderId: target.folderId,
      name: target.name,
      source: document.source,
      expectedRevision: baseline.writeRevision ?? baseline.revision,
    });
    baselines.set(document.id, { source: document.source, revision });
    localStorage.removeItem(recoveryKey(document.id));
  },
  async saveAs(document, name) {
    const target = location(document.id);
    const folder = await getFolder(`native:${target.folderId}`);
    const file = await invoke<File>("create_folder_document", { folderId: target.folderId, name });
    const saved = record(folder, file);
    const next: DocumentRecord = {
      ...saved,
      source: document.source,
      ...(document.beatsPerCycle !== undefined ? { beatsPerCycle: document.beatsPerCycle } : {}),
      ...(document.mix ? { mix: document.mix } : {}),
    };
    await this.saveToDisk!(next);
    return next;
  },
  async refreshDocument(document): Promise<DocumentRefresh> {
    const target = location(document.id);
    const file = await invoke<File>("read_folder_document", {
      folderId: target.folderId,
      name: target.name,
    });
    const baseline = baselines.get(document.id);
    const compared = baseline?.writeRevision ?? baseline?.revision;
    if (!baseline || file.revision === compared) return { source: document.source, changed: false };
    if (document.source !== baseline.source)
      return { source: document.source, changed: false, conflict: { diskSource: file.source } };
    baselines.set(document.id, { source: file.source, revision: file.revision });
    return { source: file.source, changed: true };
  },
  async acceptDisk(document) {
    const target = location(document.id);
    const file = await invoke<File>("read_folder_document", {
      folderId: target.folderId,
      name: target.name,
    });
    baselines.set(document.id, { source: file.source, revision: file.revision });
    localStorage.removeItem(recoveryKey(document.id));
    return { ...document, source: file.source, updatedAt: Date.now() };
  },
  async keepLocalOverDisk(document) {
    const target = location(document.id);
    const file = await invoke<File>("read_folder_document", {
      folderId: target.folderId,
      name: target.name,
    });
    const baseline = baselines.get(document.id);
    if (!baseline) throw new Error("Document baseline is unavailable");
    const next: Baseline = { ...baseline, writeRevision: file.revision };
    baselines.set(document.id, next);
    localStorage.setItem(
      recoveryKey(document.id),
      JSON.stringify({
        source: document.source,
        baselineSource: next.source,
        baselineRevision: next.revision,
        writeRevision: file.revision,
      }),
    );
  },
  async watchWorkspace(workspaceId, onChange) {
    if (!isNativeWorkspace(workspaceId)) return () => {};
    const id = folderId(workspaceId);
    const { listen } = await import("@tauri-apps/api/event");
    return listen<{ folderId: string }>("jamscript-folder-changed", (event) => {
      if (event.payload.folderId === id) onChange();
    });
  },
  async renameDocument(document, name) {
    if (!isNativeWorkspace(document.workspaceId))
      return browserStorage.renameDocument(document, name);
    const target = location(document.id);
    await invoke("rename_folder_document", {
      folderId: target.folderId,
      from: target.name,
      to: name,
    });
    const known = ids(target.folderId);
    known[name] = known[target.name] ?? document.id.slice("native-doc:".length);
    delete known[target.name];
    saveIds(target.folderId, known);
    locations.set(document.id, { ...target, name });
    return { ...document, name };
  },
  async deleteDocument(id) {
    if (!id.startsWith("native-doc:")) return browserStorage.deleteDocument(id);
    const target = location(id);
    await invoke("delete_folder_document", { folderId: target.folderId, name: target.name });
    localStorage.removeItem(recoveryKey(id));
    const known = ids(target.folderId);
    delete known[target.name];
    saveIds(target.folderId, known);
    locations.delete(id);
    baselines.delete(id);
  },
  async renameWorkspace(workspace, name) {
    if (isNativeWorkspace(workspace.id))
      throw new Error("Rename a selected folder in your file manager");
    return browserStorage.renameWorkspace(workspace, name);
  },
  async deleteWorkspace(id) {
    if (isNativeWorkspace(id)) throw new Error("Selected folders cannot be deleted from JamScript");
    return browserStorage.deleteWorkspace(id);
  },
};
