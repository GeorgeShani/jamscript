import { beforeEach, describe, expect, it, vi } from "vitest";

const disk = new Map<string, string>();
const folder = { id: "selected-1", name: "songs", path: "/selected/songs" };
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(
    async (
      command: string,
      args?: {
        name?: string;
        from?: string;
        to?: string;
        source?: string;
        expectedRevision?: string;
      },
    ) => {
      if (command === "list_folders") return [folder];
      if (command === "open_folder") return folder;
      if (command === "list_folder_documents")
        return [...disk].map(([name, source]) => ({ name, source, revision: source }));
      if (command === "read_folder_document") {
        const source = disk.get(args!.name!);
        return { name: args!.name, source, revision: source };
      }
      if (command === "create_folder_document") {
        if (disk.has(args!.name!)) throw new Error("already exists");
        disk.set(args!.name!, "");
        return { name: args!.name, source: "", revision: "" };
      }
      if (command === "write_folder_document") {
        if (disk.get(args!.name!) !== args!.expectedRevision) throw new Error("disk conflict");
        disk.set(args!.name!, args!.source!);
        return args!.source;
      }
      if (command === "rename_folder_document") {
        disk.set(args!.to!, disk.get(args!.from!)!);
        disk.delete(args!.from!);
      }
      if (command === "delete_folder_document") disk.delete(args!.name!);
      return undefined;
    },
  ),
}));

import { desktopStorage } from "../../desktop/storage";

describe("desktop folder storage", () => {
  beforeEach(() => {
    disk.clear();
    localStorage.clear();
  });

  it("keeps edits in recovery until explicit disk save and detects an external conflict", async () => {
    disk.set("coastline.js", "original");
    const workspace = (await desktopStorage.openFolder!())!;
    const [document] = await desktopStorage.listDocuments(workspace.id);
    expect(document?.source).toBe("original");
    const edited = { ...document!, source: "edited" };
    await desktopStorage.saveDocument(edited);
    expect(disk.get("coastline.js")).toBe("original");
    expect(desktopStorage.isDirty!(edited)).toBe(true);
    expect((await desktopStorage.listDocuments(workspace.id))[0]?.source).toBe("edited");
    disk.set("coastline.js", "external");
    expect((await desktopStorage.listDocuments(workspace.id))[0]?.source).toBe("edited");
    const conflict = await desktopStorage.refreshDocument!(edited);
    expect(conflict.conflict?.diskSource).toBe("external");
    expect(conflict.changed).toBe(false);
    await expect(desktopStorage.saveToDisk!(edited)).rejects.toThrow("disk conflict");
    await desktopStorage.keepLocalOverDisk!(edited);
    await desktopStorage.saveToDisk!(edited);
    expect(disk.get("coastline.js")).toBe("edited");
    expect(desktopStorage.isDirty!(edited)).toBe(false);
  });

  it("reloads a clean external edit and leaves the buffer dirty when they diverge", async () => {
    disk.set("song.js", "clean");
    const workspace = (await desktopStorage.openFolder!())!;
    const [document] = await desktopStorage.listDocuments(workspace.id);
    disk.set("song.js", "from disk");
    const reloaded = await desktopStorage.refreshDocument!(document!);
    expect(reloaded).toEqual({ source: "from disk", changed: true });
    const dirty = { ...document!, source: "local edit" };
    await desktopStorage.saveDocument(dirty);
    disk.set("song.js", "someone else");
    const blocked = await desktopStorage.refreshDocument!(dirty);
    expect(blocked.conflict?.diskSource).toBe("someone else");
    expect(desktopStorage.isDirty!(dirty)).toBe(true);
  });

  it("keeps a stable document ID after native rename", async () => {
    disk.set("old.js", "sound('bd')");
    const workspace = (await desktopStorage.openFolder!())!;
    const [original] = await desktopStorage.listDocuments(workspace.id);
    const renamed = await desktopStorage.renameDocument(original!, "new.js");
    expect(renamed.id).toBe(original!.id);
    expect((await desktopStorage.listDocuments(workspace.id))[0]?.id).toBe(original!.id);
  });
});
