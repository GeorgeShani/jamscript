// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  documentRevisions,
  documents,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

describe("Drizzle workspace migrations", () => {
  it("applies in order and enforces workspace, document and invitation invariants", async () => {
    const client = new PGlite();
    const db = drizzle({ client });

    try {
      // Simulate an upstream default grant so the privacy migration must revoke it.
      await client.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
      await client.exec("ALTER DEFAULT PRIVILEGES GRANT USAGE ON SCHEMAS TO anon, authenticated;");
      await client.exec("ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO anon, authenticated;");
      await client.exec("CREATE SCHEMA grant_probe; CREATE TABLE grant_probe.probe (id integer);");
      const probe = await client.query<{ schemaAccess: boolean; tableAccess: boolean }>(`
        SELECT
          has_schema_privilege('anon', 'grant_probe', 'USAGE') AS "schemaAccess",
          has_table_privilege('authenticated', 'grant_probe.probe', 'SELECT') AS "tableAccess"
      `);
      expect(probe.rows[0]).toEqual({ schemaAccess: true, tableAccess: true });

      await migrate(db, { migrationsFolder: "./drizzle" });
      await migrate(db, { migrationsFolder: "./drizzle" });

      const grants = await client.query<{ schemaAccess: boolean; tableAccess: boolean }>(`
        SELECT
          has_schema_privilege('anon', 'jamscript', 'USAGE') AS "schemaAccess",
          has_table_privilege('authenticated', 'jamscript.documents', 'SELECT') AS "tableAccess"
      `);
      expect(grants.rows[0]).toEqual({ schemaAccess: false, tableAccess: false });

      const [workspace] = await db
        .insert(workspaces)
        .values({ name: "Night bus", createdByClerkUserId: "user_owner" })
        .returning();
      if (!workspace) throw new Error("Workspace insert returned no row");
      await db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        clerkUserId: "user_owner",
        role: "owner",
      });

      await expect(
        db.insert(workspaceMembers).values({
          workspaceId: workspace.id,
          clerkUserId: "user_second_owner",
          role: "owner",
        }),
      ).rejects.toThrow();

      const [document] = await db
        .insert(documents)
        .values({ workspaceId: workspace.id, name: "night-bus.js", source: 's("bd")' })
        .returning();
      if (!document) throw new Error("Document insert returned no row");
      await expect(
        db.insert(documents).values({ workspaceId: workspace.id, name: "night-bus.js" }),
      ).rejects.toThrow();

      await db.insert(documentRevisions).values({
        documentId: document.id,
        version: 1,
        source: document.source,
        savedByClerkUserId: "user_owner",
      });
      await expect(
        db.insert(documentRevisions).values({
          documentId: document.id,
          version: 1,
          source: "duplicate",
          savedByClerkUserId: "user_owner",
        }),
      ).rejects.toThrow();

      await db.insert(workspaceInvitations).values({
        workspaceId: workspace.id,
        invitedEmail: "guest@example.com",
        role: "editor",
        tokenHash: "a".repeat(64),
        invitedByClerkUserId: "user_owner",
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(
        db.insert(workspaceInvitations).values({
          workspaceId: workspace.id,
          invitedEmail: "GUEST@example.com",
          role: "editor",
          tokenHash: "b".repeat(64),
          invitedByClerkUserId: "user_owner",
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ).rejects.toThrow();

      await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      expect(await db.select().from(documents)).toHaveLength(0);
      expect(await db.select().from(documentRevisions)).toHaveLength(0);
      expect(await db.select().from(workspaceMembers)).toHaveLength(0);
      expect(await db.select().from(workspaceInvitations)).toHaveLength(0);
    } finally {
      await client.close();
    }
  });
});
