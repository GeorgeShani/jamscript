import {
  browserStorage,
  type DocumentRecord,
  type WorkspaceRecord,
  type WorkspaceStorage,
} from "@/workspaces/storage";

/** One server document opened in the workbench. Yjs owns live edits; this copy is the local buffer. */
export function sharedDocumentStorage(input: {
  workspace: WorkspaceRecord;
  documents: DocumentRecord[];
}): WorkspaceStorage {
  const workspace = input.workspace;
  const documents = new Map(input.documents.map((document) => [document.id, document]));
  return {
    ...browserStorage,
    async listWorkspaces() {
      return [workspace];
    },
    async listDocuments(workspaceId) {
      return workspaceId === workspace.id ? [...documents.values()] : [];
    },
    async saveDocument(next) {
      const saved = { ...next, updatedAt: Date.now() };
      documents.set(next.id, saved);
      return saved;
    },
    async renameDocument(document, name) {
      if (document.shared?.role === "viewer") throw new Error("Viewer access is read only");
      const response = await fetch("/api/shared-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename-document", documentId: document.id, name }),
      });
      const result = (await response.json()) as { name?: string; error?: string };
      if (!response.ok || !result.name)
        throw new Error(result.error ?? "Could not rename the shared file");
      const renamed = { ...document, name: result.name, updatedAt: Date.now() };
      documents.set(document.id, renamed);
      return renamed;
    },
    async renameWorkspace() {
      throw new Error("Shared workspace renaming is not available yet");
    },
    async createDocument() {
      throw new Error("Shared files are added by the project owner");
    },
    async createWorkspace() {
      throw new Error("This shared project already exists");
    },
    async deleteDocument() {
      throw new Error("Shared files are removed by the project owner");
    },
    async deleteWorkspace() {
      throw new Error("Leave the project from the invitation instead of deleting it");
    },
  };
}
