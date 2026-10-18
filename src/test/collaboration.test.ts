// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import {
  acceptInvitation,
  createInvitation,
  createSharedProject,
  hashInviteToken,
  listVisibleDocuments,
  listWorkspaceDocuments,
  memberRole,
  roleForDocument,
  renameSharedDocument,
  revokeInvitation,
  type CollaborationDb,
} from "@/features/collaboration/membership";
import {
  createLocalUndo,
  documentIdFromRoom,
  localEditOrigin,
  roomId,
  seedSharedText,
  sharedSource,
} from "@/features/collaboration/shared-document";
import { sharedDocumentStorage } from "@/features/collaboration/shared-storage";

async function database() {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as CollaborationDb;
}

describe("shared project membership", () => {
  it("lets an owner invite, blocks a revoked invite, and rejects a viewer write role", async () => {
    const db = await database();
    const project = await createSharedProject(db, {
      name: "Coastline",
      ownerId: "user_owner",
      documentName: "coastline.strudel",
      source: "setcps(0.75)",
      additionalDocuments: [{ name: "bass.js", source: 'note("c2").s("gm_acoustic_bass")' }],
    });
    expect(await memberRole(db, project.workspaceId, "user_owner")).toBe("owner");
    expect(await roleForDocument(db, project.documentId, "user_owner")).toMatchObject({
      workspaceName: "Coastline",
      name: "coastline.strudel",
      role: "owner",
    });
    const invitation = await createInvitation(db, {
      workspaceId: project.workspaceId,
      actorId: "user_owner",
      email: "Listener@Example.com",
      role: "viewer",
    });
    await revokeInvitation(db, { invitationId: invitation.invitationId, actorId: "user_owner" });
    await expect(
      acceptInvitation(db, {
        token: invitation.token,
        userId: "user_listener",
        email: "listener@example.com",
      }),
    ).rejects.toThrow(/not active/);
    expect(await memberRole(db, project.workspaceId, "user_listener")).toBeNull();

    const editorInvite = await createInvitation(db, {
      workspaceId: project.workspaceId,
      actorId: "user_owner",
      email: "editor@example.com",
      role: "editor",
    });
    const accepted = await acceptInvitation(db, {
      token: editorInvite.token,
      userId: "user_editor",
      email: "editor@example.com",
    });
    expect(accepted.role).toBe("editor");
    const visible = await listVisibleDocuments(db, "user_editor");
    expect(visible.map((item) => item.documentName).sort()).toEqual([
      "bass.js",
      "coastline.strudel",
    ]);
    expect(
      (await listWorkspaceDocuments(db, project.workspaceId, "user_editor"))
        ?.map((item) => item.name)
        .sort(),
    ).toEqual(["bass.js", "coastline.strudel"]);
    expect(await listWorkspaceDocuments(db, project.workspaceId, "user_listener")).toBeNull();
    await expect(
      renameSharedDocument(db, {
        documentId: project.documentId,
        actorId: "user_listener",
        name: "forbidden.js",
      }),
    ).rejects.toThrow(/permission/);
    const renamed = await renameSharedDocument(db, {
      documentId: project.documentId,
      actorId: "user_editor",
      name: "coastline-remix.strudel",
    });
    expect(renamed.id).toBe(project.documentId);
    expect((await roleForDocument(db, project.documentId, "user_owner"))?.name).toBe(
      "coastline-remix.strudel",
    );
    expect(await listVisibleDocuments(db, "user_listener")).toEqual([]);
    expect(hashInviteToken(editorInvite.token)).toHaveLength(64);
    await expect(
      createInvitation(db, {
        workspaceId: project.workspaceId,
        actorId: "user_editor",
        email: "other@example.com",
        role: "viewer",
      }),
    ).rejects.toThrow(/owner/);
    await expect(
      createInvitation(db, {
        workspaceId: project.workspaceId,
        actorId: "user_owner",
        email: "other@example.com",
        role: "owner" as "editor",
      }),
    ).rejects.toThrow(/Invalid invitation role/);
  });
});

describe("shared source", () => {
  it("seeds a document once and keeps local undo away from remote edits", () => {
    const origin = new Y.Doc();
    expect(seedSharedText(origin, "setcps(0.75)")).toBe(true);
    const copy = new Y.Doc();
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(origin));
    expect(seedSharedText(copy, "setcps(0.75)\nagain")).toBe(false);
    expect(sharedSource(copy)).toBe("setcps(0.75)");

    const undo = createLocalUndo(copy);
    copy.transact(
      () => copy.getText("source").insert(sharedSource(copy).length, "\nlocal"),
      localEditOrigin,
    );
    copy.transact(() => copy.getText("source").insert(0, "remote "), "remote-user");
    undo.undo();
    expect(sharedSource(copy)).toBe("remote setcps(0.75)");
    const id = "11111111-1111-4111-8111-111111111111";
    expect(documentIdFromRoom(roomId(id))).toBe(id);
    expect(documentIdFromRoom("jamscript:../secret")).toBeNull();
  });

  it("updates shared metadata only after the server confirms the rename", async () => {
    const workspace = { id: "shared", name: "Coastline", createdAt: 0, updatedAt: 0 };
    const document = {
      id: "song",
      workspaceId: workspace.id,
      name: "coastline.strudel",
      source: 's("bd")',
      shared: { workspaceId: workspace.id, documentId: "song", role: "editor" as const },
      createdAt: 0,
      updatedAt: 0,
    };
    const storage = sharedDocumentStorage({ workspace, documents: [document] });
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unavailable" }), { status: 503 }),
      );
    vi.stubGlobal("fetch", request);
    await expect(storage.renameDocument(document, "renamed.js")).rejects.toThrow(/Unavailable/);
    expect((await storage.listDocuments(workspace.id))[0]?.name).toBe(document.name);
    request.mockResolvedValueOnce(Response.json({ id: "song", name: "renamed.js" }));
    expect((await storage.renameDocument(document, "renamed.js")).name).toBe("renamed.js");
    expect((await storage.listDocuments(workspace.id))[0]?.name).toBe("renamed.js");
    vi.unstubAllGlobals();
  });
});
