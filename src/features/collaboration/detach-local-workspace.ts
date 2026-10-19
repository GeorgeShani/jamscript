import type { WorkspaceStorage } from "@/workspaces/storage";

/** Keep local source files when their remote collaboration workspace is removed. */
export async function detachLocalWorkspace(storage: WorkspaceStorage, remoteWorkspaceId: string) {
  for (const workspace of await storage.listWorkspaces()) {
    let documents;
    try {
      documents = await storage.listDocuments(workspace.id);
    } catch (cause) {
      if (storage.isNativeWorkspace?.(workspace.id)) continue;
      throw cause;
    }
    for (const document of documents) {
      if (document.shared?.workspaceId !== remoteWorkspaceId) continue;
      const localDocument = { ...document };
      delete localDocument.shared;
      await storage.saveDocument(localDocument);
    }
  }
}
