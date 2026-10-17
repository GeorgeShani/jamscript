import {
  browserStorage,
  type DocumentRecord,
  type WorkspaceRecord,
  type WorkspaceStorage,
} from "@/workspaces/storage";

/** One server document opened in the workbench. Yjs owns live edits; this copy is the local buffer. */
export function sharedDocumentStorage(input: {
  workspace: WorkspaceRecord;
  document: DocumentRecord;
}): WorkspaceStorage {
  let workspace = input.workspace;
  let document = input.document;
  return {
    ...browserStorage,
    async listWorkspaces() {
      return [workspace];
    },
    async listDocuments(workspaceId) {
      return workspaceId === workspace.id ? [document] : [];
    },
    async saveDocument(next) {
      document = { ...next, updatedAt: Date.now() };
      return document;
    },
    async renameDocument(next, name) {
      document = { ...next, name, updatedAt: Date.now() };
      return document;
    },
    async renameWorkspace(next, name) {
      workspace = { ...next, name, updatedAt: Date.now() };
      return workspace;
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
