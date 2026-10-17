// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  acceptInvitation,
  createInvitation,
  createSharedProject,
  hashInviteToken,
  listVisibleDocuments,
  memberRole,
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
    });
    expect(await memberRole(db, project.workspaceId, "user_owner")).toBe("owner");
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
    expect(visible.map((item) => item.documentName)).toEqual(["coastline.strudel"]);
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
    copy.transact(() => copy.getText("source").insert(sharedSource(copy).length, "\nlocal"), localEditOrigin);
    copy.transact(() => copy.getText("source").insert(0, "remote "), "remote-user");
    undo.undo();
    expect(sharedSource(copy)).toBe("remote setcps(0.75)");
    const id = "11111111-1111-4111-8111-111111111111";
    expect(documentIdFromRoom(roomId(id))).toBe(id);
    expect(documentIdFromRoom("jamscript:../secret")).toBeNull();
  });
});
