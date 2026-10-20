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
  deleteSharedWorkspace,
  hashInviteToken,
  listVisibleDocuments,
  listWorkspaceDocuments,
  listWorkspaceMembers,
  leaveSharedWorkspace,
  memberRole,
  openSharedWorkspace,
  removeMember,
  roleForDocument,
  validInvitationEmail,
  renameSharedDocument,
  renameSharedWorkspace,
  revokeInvitation,
  type CollaborationDb,
} from "@/features/collaboration/membership";
import {
  readLiveblocksDocument,
  seedLiveblocksDocument,
} from "@/features/collaboration/liveblocks-document";
import {
  createLocalUndo,
  documentIdFromRoom,
  localEditOrigin,
  roomId,
  seedSharedText,
  sharedSource,
} from "@/features/collaboration/shared-document";
import { sharedDocumentStorage } from "@/features/collaboration/shared-storage";
import type { Liveblocks } from "@liveblocks/node";

async function database(logQuery: () => void = () => {}) {
  const client = new PGlite();
  const db = drizzle({ client, logger: { logQuery } });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as CollaborationDb;
}

describe("shared project membership", () => {
  it("lists members with authorization and accepted emails in one database round trip", async () => {
    const logQuery = vi.fn();
    const db = await database(logQuery);
    const project = await createSharedProject(db, {
      name: "Latency check",
      ownerId: "owner",
      documentName: "song.js",
      source: 's("bd")',
    });
    // Rejoining with a second invitation must not duplicate the member row.
    for (let index = 0; index < 2; index++) {
      const invite = await createInvitation(db, {
        workspaceId: project.workspaceId,
        actorId: "owner",
        email: "editor@example.com",
        role: "editor",
      });
      await acceptInvitation(db, {
        token: invite.token,
        userId: "editor",
        email: "editor@example.com",
      });
    }
    logQuery.mockClear();
    const members = await listWorkspaceMembers(db, project.workspaceId, "owner");
    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ userId: "owner", role: "owner", email: null });
    expect(members[1]).toMatchObject({ userId: "editor", email: "editor@example.com" });
    expect(logQuery).toHaveBeenCalledTimes(1);
    await expect(listWorkspaceMembers(db, project.workspaceId, "outsider")).rejects.toThrow(
      "No access",
    );
  });
  it("opens an authorized workspace in one database round trip", async () => {
    const logQuery = vi.fn();
    const db = await database(logQuery);
    const project = await createSharedProject(db, {
      name: "Coastline",
      ownerId: "owner",
      documentName: "song.js",
      source: 's("bd")',
    });
    logQuery.mockClear();
    const opened = await openSharedWorkspace(db, project.documentId, "owner");
    expect(opened?.access).toMatchObject({ role: "owner", source: 's("bd")', name: "song.js" });
    expect(opened?.documents).toEqual([
      { id: project.documentId, name: "song.js", source: 's("bd")' },
    ]);
    expect(logQuery).toHaveBeenCalledTimes(1);
    expect(await openSharedWorkspace(db, project.documentId, "outsider")).toBeNull();
    expect(
      await openSharedWorkspace(db, "00000000-0000-4000-8000-000000000000", "owner"),
    ).toBeNull();
  });

  it("limits shared workspace rename and deletion to the owner and lets members leave", async () => {
    const db = await database();
    const project = await createSharedProject(db, {
      name: "Coastline",
      ownerId: "owner",
      documentName: "song.js",
      source: 's("bd")',
    });
    const invite = await createInvitation(db, {
      workspaceId: project.workspaceId,
      actorId: "owner",
      email: "editor@example.com",
      role: "editor",
    });
    await acceptInvitation(db, {
      token: invite.token,
      userId: "editor",
      email: "editor@example.com",
    });
    await expect(
      renameSharedWorkspace(db, {
        workspaceId: project.workspaceId,
        actorId: "editor",
        name: "Other",
      }),
    ).rejects.toThrow(/owner/);
    await expect(
      deleteSharedWorkspace(db, { workspaceId: project.workspaceId, actorId: "editor" }),
    ).rejects.toThrow(/owner/);
    await expect(
      leaveSharedWorkspace(db, { workspaceId: project.workspaceId, actorId: "owner" }),
    ).rejects.toThrow(/owner/);
    expect(
      await renameSharedWorkspace(db, {
        workspaceId: project.workspaceId,
        actorId: "owner",
        name: "  New name  ",
      }),
    ).toMatchObject({ name: "New name" });
    expect((await listVisibleDocuments(db, "editor"))[0]?.workspaceName).toBe("New name");
    await leaveSharedWorkspace(db, { workspaceId: project.workspaceId, actorId: "editor" });
    expect(await listVisibleDocuments(db, "editor")).toEqual([]);
    expect(
      await deleteSharedWorkspace(db, { workspaceId: project.workspaceId, actorId: "owner" }),
    ).toEqual([project.documentId]);
    expect(await listVisibleDocuments(db, "owner")).toEqual([]);
  });

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
    const members = await listWorkspaceMembers(db, project.workspaceId, "user_owner");
    expect(members.map((member) => [member.userId, member.role, member.email])).toEqual([
      ["user_owner", "owner", null],
      ["user_editor", "editor", "editor@example.com"],
    ]);
    await expect(listWorkspaceMembers(db, project.workspaceId, "user_listener")).rejects.toThrow(
      /No access/,
    );
    await removeMember(db, {
      workspaceId: project.workspaceId,
      actorId: "user_owner",
      memberId: "user_editor",
    });
    expect(await memberRole(db, project.workspaceId, "user_editor")).toBeNull();
    const editorInviteAgain = await createInvitation(db, {
      workspaceId: project.workspaceId,
      actorId: "user_owner",
      email: "editor@example.com",
      role: "editor",
    });
    await acceptInvitation(db, {
      token: editorInviteAgain.token,
      userId: "user_editor",
      email: "editor@example.com",
    });
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
    const opened = await openSharedWorkspace(db, project.documentId, "user_editor");
    expect(opened?.access.role).toBe("editor");
    expect(opened?.documents.map((item) => item.name).sort()).toEqual([
      "bass.js",
      "coastline.strudel",
    ]);
    expect(await openSharedWorkspace(db, project.documentId, "user_listener")).toBeNull();
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
    expect(validInvitationEmail("person@example.com\nBcc: attacker@example.com")).toBe(false);
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

describe("liveblocks document rooms", () => {
  it("creates the room before seeding and heals empty rooms from the database", async () => {
    const rooms = new Map<string, Uint8Array>();
    const liveblocks = {
      getOrCreateRoom: vi.fn(async (id: string) => {
        if (!rooms.has(id)) rooms.set(id, new Uint8Array());
        return { id };
      }),
      sendYjsBinaryUpdate: vi.fn(async (id: string, update: Uint8Array) => {
        const doc = new Y.Doc();
        const existing = rooms.get(id);
        if (existing?.length) Y.applyUpdate(doc, existing);
        Y.applyUpdate(doc, update);
        rooms.set(id, Y.encodeStateAsUpdate(doc));
      }),
      getYjsDocumentAsBinaryUpdate: vi.fn(async (id: string) => {
        const update = rooms.get(id);
        if (!update) throw new Error("Room not found");
        return update.buffer.slice(update.byteOffset, update.byteOffset + update.byteLength);
      }),
    } as unknown as Liveblocks;

    await seedLiveblocksDocument(liveblocks, "doc-1", 's("bd")');
    expect(liveblocks.getOrCreateRoom).toHaveBeenCalledWith(roomId("doc-1"), {
      defaultAccesses: [],
    });
    vi.mocked(liveblocks.getOrCreateRoom).mockClear();
    expect(
      await readLiveblocksDocument(liveblocks, { id: "doc-1", name: "a.js", source: "" }),
    ).toEqual({ id: "doc-1", name: "a.js", source: 's("bd")' });
    // Happy path reads the Yjs update without a second getOrCreateRoom.
    expect(liveblocks.getOrCreateRoom).not.toHaveBeenCalled();

    rooms.set(roomId("doc-2"), new Uint8Array());
    expect(
      await readLiveblocksDocument(liveblocks, {
        id: "doc-2",
        name: "b.js",
        source: 's("sd")',
      }),
    ).toEqual({ id: "doc-2", name: "b.js", source: 's("sd")' });
  });

  it("falls back to the database source when Liveblocks is unavailable", async () => {
    const liveblocks = {
      getOrCreateRoom: vi.fn(async () => {
        throw new Error("offline");
      }),
      sendYjsBinaryUpdate: vi.fn(),
      getYjsDocumentAsBinaryUpdate: vi.fn(),
    } as unknown as Liveblocks;
    expect(
      await readLiveblocksDocument(liveblocks, {
        id: "doc-3",
        name: "c.js",
        source: 's("hh")',
      }),
    ).toEqual({ id: "doc-3", name: "c.js", source: 's("hh")' });
  });
});
