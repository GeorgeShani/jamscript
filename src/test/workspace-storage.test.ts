import { describe, expect, it } from "vitest";
import {
  createDocument,
  createWorkspace,
  deleteDocument,
  deleteWorkspace,
  listDocuments,
  listWorkspaces,
  renameDocument,
  renameWorkspace,
  saveDocument,
} from "@/workspaces/storage";

describe("browser workspace storage", () => {
  it("persists workspace and document CRUD across database reads", async () => {
    const created = await createWorkspace(`Workspace ${crypto.randomUUID()}`, "setcps(0.5)");
    const id = created.workspace.id;
    try {
      expect((await listWorkspaces()).some((item) => item.id === id)).toBe(true);
      expect(await listDocuments(id)).toEqual([created.document]);

      const renamedWorkspace = await renameWorkspace(created.workspace, "Renamed workspace");
      expect((await listWorkspaces()).find((item) => item.id === id)?.name).toBe(
        "Renamed workspace",
      );
      expect(renamedWorkspace.name).toBe("Renamed workspace");

      const second = await createDocument(id, "drums.js");
      const edited = await saveDocument({ ...second, source: 's("bd")' });
      await renameDocument(edited, "percussion.js");
      expect((await listDocuments(id)).find((item) => item.id === second.id)).toMatchObject({
        name: "percussion.js",
        source: 's("bd")',
      });

      await deleteDocument(second.id);
      expect((await listDocuments(id)).map((item) => item.id)).toEqual([created.document.id]);
    } finally {
      await deleteWorkspace(id);
    }
    expect((await listWorkspaces()).some((item) => item.id === id)).toBe(false);
    expect(await listDocuments(id)).toEqual([]);
  });
});
