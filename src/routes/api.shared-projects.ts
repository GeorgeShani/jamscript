import { createFileRoute } from "@tanstack/react-router";
import { Liveblocks } from "@liveblocks/node";
import * as Y from "yjs";

import { withCollaborationDb } from "@/features/collaboration/database";
import {
  acceptInvitation,
  createInvitation,
  createSharedProject,
  listVisibleDocuments,
  removeMember,
  revokeInvitation,
  roleForDocument,
} from "@/features/collaboration/membership";
import { roomId, seedSharedText } from "@/features/collaboration/shared-document";

const headers = { "Cache-Control": "private, no-store" };

async function actor() {
  if (!process.env["CLERK_SECRET_KEY"] || !process.env["DATABASE_URL"] || !process.env["LIVEBLOCKS_SECRET_KEY"])
    return { error: Response.json({ error: "Collaboration is not configured" }, { status: 503, headers }) };
  const { auth } = await import("@clerk/tanstack-react-start/server");
  const { userId, isAuthenticated } = await auth();
  if (!isAuthenticated || !userId)
    return { error: Response.json({ error: "Sign in required" }, { status: 401, headers }) };
  return { userId };
}

export const Route = createFileRoute("/api/shared-projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const current = await actor();
        if ("error" in current && current.error) return current.error;
        const url = new URL(request.url);
        const documentId = url.searchParams.get("documentId");
        if (documentId) {
          const access = await withCollaborationDb((db) =>
            roleForDocument(db, documentId, current.userId),
          );
          if (!access) return Response.json({ error: "No access to this document" }, { status: 403, headers });
          return Response.json(
            {
              documentId,
              workspaceId: access.workspaceId,
              name: access.name,
              source: access.source,
              role: access.role,
            },
            { headers },
          );
        }
        const documents = await withCollaborationDb((db) => listVisibleDocuments(db, current.userId));
        return Response.json(documents, { headers });
      },
      POST: async ({ request }) => {
        const current = await actor();
        if ("error" in current && current.error) return current.error;
        const body = (await request.json()) as { action?: unknown; [key: string]: unknown };
        const text = (key: string) => (typeof body[key] === "string" ? body[key] : "");
        try {
          if (body.action === "create") {
            const source = text("source");
            const created = await withCollaborationDb((db) =>
              createSharedProject(db, {
                name: text("name"),
                ownerId: current.userId,
                documentName: text("documentName"),
                source,
              }),
            );
            const doc = new Y.Doc();
            seedSharedText(doc, source);
            const liveblocks = new Liveblocks({ secret: process.env["LIVEBLOCKS_SECRET_KEY"]! });
            await liveblocks.sendYjsBinaryUpdate(roomId(created.documentId), Y.encodeStateAsUpdate(doc));
            return Response.json(created, { headers });
          }
          if (body.action === "invite") {
            const invitation = await withCollaborationDb((db) =>
              createInvitation(db, {
                workspaceId: text("workspaceId"),
                actorId: current.userId,
                email: text("email"),
                role: text("role") === "viewer" ? "viewer" : "editor",
              }),
            );
            const origin = process.env["APP_ORIGIN"] ?? new URL(request.url).origin;
            return Response.json(
              {
                invitationId: invitation.invitationId,
                url: `${origin}/app/invitations/${invitation.token}`,
              },
              { headers },
            );
          }
          if (body.action === "revoke") {
            await withCollaborationDb((db) =>
              revokeInvitation(db, {
                invitationId: text("invitationId"),
                actorId: current.userId,
              }),
            );
            return Response.json({ ok: true }, { headers });
          }
          if (body.action === "remove-member") {
            await withCollaborationDb((db) =>
              removeMember(db, {
                workspaceId: text("workspaceId"),
                actorId: current.userId,
                memberId: text("memberId"),
              }),
            );
            return Response.json({ ok: true }, { headers });
          }
          if (body.action === "accept") {
            const { clerkClient } = await import("@clerk/tanstack-react-start/server");
            const user = await clerkClient().users.getUser(current.userId);
            const email =
              user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress ?? "";
            const accepted = await withCollaborationDb((db) =>
              acceptInvitation(db, { token: text("token"), userId: current.userId, email }),
            );
            return Response.json(accepted, { headers });
          }
          return Response.json({ error: "Unknown collaboration action" }, { status: 400, headers });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Collaboration request failed";
          const status = /not active|expired|different account|Only the owner|invalid/i.test(message) ? 403 : 400;
          return Response.json({ error: message }, { status, headers });
        }
      },
    },
  },
});
