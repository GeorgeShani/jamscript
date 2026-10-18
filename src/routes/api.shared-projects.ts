import { createFileRoute } from "@tanstack/react-router";
import { Liveblocks } from "@liveblocks/node";
import * as Y from "yjs";

import { withCollaborationDb } from "@/features/collaboration/database";
import {
  acceptInvitation,
  createInvitation,
  createSharedProject,
  listActiveInvitations,
  listWorkspaceDocuments,
  listVisibleDocuments,
  removeMember,
  renameSharedDocument,
  revokeInvitation,
  roleForDocument,
  validInvitationEmail,
  workspaceNameForOwner,
} from "@/features/collaboration/membership";
import { roomId, seedSharedText } from "@/features/collaboration/shared-document";

const headers = { "Cache-Control": "private, no-store" };

async function invite(
  workspaceId: string,
  workspaceName: string,
  actorId: string,
  email: string,
  role: "editor" | "viewer",
  origin: string,
) {
  const invitation = await withCollaborationDb((db) =>
    createInvitation(db, { workspaceId, actorId, email, role }),
  );
  const url = `${origin}/app/invitations/${invitation.token}`;
  try {
    const { sendInvitationEmail } =
      await import("@/features/collaboration/invitation-email.server");
    const sent = await sendInvitationEmail({
      to: invitation.email,
      workspaceName,
      role,
      url,
    });
    return sent
      ? { invitationId: invitation.invitationId, delivery: "email" as const }
      : { invitationId: invitation.invitationId, delivery: "link" as const, url };
  } catch {
    await withCollaborationDb((db) =>
      revokeInvitation(db, { invitationId: invitation.invitationId, actorId }),
    );
    throw new Error(
      "Invitation email could not be sent. Check the server SMTP settings and retry.",
    );
  }
}

async function actor() {
  if (
    !process.env["CLERK_SECRET_KEY"] ||
    !process.env["DATABASE_URL"] ||
    !process.env["LIVEBLOCKS_SECRET_KEY"]
  )
    return {
      error: Response.json({ error: "Collaboration is not configured" }, { status: 503, headers }),
    };
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
        const invitationWorkspace = url.searchParams.get("workspaceId");
        if (invitationWorkspace && url.searchParams.get("invitations") === "1") {
          try {
            const invitations = await withCollaborationDb((db) =>
              listActiveInvitations(db, invitationWorkspace, current.userId),
            );
            return Response.json(invitations, { headers });
          } catch {
            return Response.json({ error: "No access to invitations" }, { status: 403, headers });
          }
        }
        const documentId = url.searchParams.get("documentId");
        if (documentId) {
          const access = await withCollaborationDb((db) =>
            roleForDocument(db, documentId, current.userId),
          );
          if (!access)
            return Response.json({ error: "No access to this document" }, { status: 403, headers });
          const files = await withCollaborationDb((db) =>
            listWorkspaceDocuments(db, access.workspaceId, current.userId),
          );
          let liveFiles: { id: string; name: string; source: string }[];
          try {
            const liveblocks = new Liveblocks({ secret: process.env["LIVEBLOCKS_SECRET_KEY"]! });
            liveFiles = await Promise.all(
              (files ?? []).map(async (file) => {
                const update = await liveblocks.getYjsDocumentAsBinaryUpdate(roomId(file.id));
                const doc = new Y.Doc();
                Y.applyUpdate(doc, new Uint8Array(update));
                return { id: file.id, name: file.name, source: doc.getText("source").toString() };
              }),
            );
          } catch {
            return Response.json(
              { error: "Shared source is temporarily unavailable. Retry when connected." },
              { status: 503, headers },
            );
          }
          return Response.json(
            {
              documentId,
              workspaceId: access.workspaceId,
              workspaceName: access.workspaceName,
              name: access.name,
              source: liveFiles.find((file) => file.id === documentId)?.source ?? access.source,
              role: access.role,
              documents: liveFiles,
            },
            { headers },
          );
        }
        const documents = await withCollaborationDb((db) =>
          listVisibleDocuments(db, current.userId),
        );
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
            const email = text("email").trim();
            const invitationRole = body["role"];
            if (email && invitationRole !== "editor" && invitationRole !== "viewer")
              return Response.json({ error: "Invalid invitation role" }, { status: 400, headers });
            if (email && !validInvitationEmail(email))
              return Response.json(
                { error: "Invitation email is invalid" },
                { status: 400, headers },
              );
            const additionalDocuments = Array.isArray(body["files"])
              ? body["files"].map((item) => {
                  const file = item as { name?: unknown; source?: unknown };
                  return {
                    name: typeof file?.name === "string" ? file.name : "",
                    source: typeof file?.source === "string" ? file.source : "",
                  };
                })
              : [];
            const created = await withCollaborationDb((db) =>
              createSharedProject(db, {
                name: text("name"),
                ownerId: current.userId,
                documentName: text("documentName"),
                source,
                additionalDocuments,
              }),
            );
            const liveblocks = new Liveblocks({ secret: process.env["LIVEBLOCKS_SECRET_KEY"]! });
            await Promise.all(
              created.documents.map(async (file) => {
                const doc = new Y.Doc();
                seedSharedText(doc, file.source);
                await liveblocks.sendYjsBinaryUpdate(roomId(file.id), Y.encodeStateAsUpdate(doc));
              }),
            );
            const origin = process.env["APP_ORIGIN"] ?? new URL(request.url).origin;
            let delivery:
              { invitationId: string; delivery: "email" | "link"; url?: string } | undefined;
            let invitationError: string | undefined;
            if (email) {
              try {
                delivery = await invite(
                  created.workspaceId,
                  text("name").trim(),
                  current.userId,
                  email,
                  invitationRole as "editor" | "viewer",
                  origin,
                );
              } catch (cause) {
                invitationError =
                  cause instanceof Error ? cause.message : "Invitation could not be sent";
              }
            }
            return Response.json(
              {
                workspaceId: created.workspaceId,
                documentId: created.documentId,
                documents: created.documents.map(({ id, name }) => ({ id, name })),
                role: created.role,
                ...delivery,
                ...(invitationError ? { invitationError } : {}),
              },
              { headers },
            );
          }
          if (body.action === "invite") {
            const invitationRole = body["role"];
            if (invitationRole !== "editor" && invitationRole !== "viewer")
              return Response.json({ error: "Invalid invitation role" }, { status: 400, headers });
            const workspaceId = text("workspaceId");
            const workspaceName = await withCollaborationDb((db) =>
              workspaceNameForOwner(db, workspaceId, current.userId),
            );
            const origin = process.env["APP_ORIGIN"] ?? new URL(request.url).origin;
            return Response.json(
              await invite(
                workspaceId,
                workspaceName,
                current.userId,
                text("email"),
                invitationRole,
                origin,
              ),
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
          if (body.action === "rename-document") {
            const renamed = await withCollaborationDb((db) =>
              renameSharedDocument(db, {
                documentId: text("documentId"),
                actorId: current.userId,
                name: text("name"),
              }),
            );
            return Response.json(renamed, { headers });
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
              user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)
                ?.emailAddress ?? "";
            const accepted = await withCollaborationDb((db) =>
              acceptInvitation(db, { token: text("token"), userId: current.userId, email }),
            );
            return Response.json(accepted, { headers });
          }
          return Response.json({ error: "Unknown collaboration action" }, { status: 400, headers });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Collaboration request failed";
          const status = /not active|expired|different account|Only the owner|invalid/i.test(
            message,
          )
            ? 403
            : 400;
          return Response.json({ error: message }, { status, headers });
        }
      },
    },
  },
});
