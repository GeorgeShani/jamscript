import { createFileRoute } from "@tanstack/react-router";
import { Liveblocks } from "@liveblocks/node";

import { withCollaborationDb } from "@/features/collaboration/database";
import {
  acceptInvitation,
  createInvitation,
  createSharedProject,
  deleteSharedWorkspace,
  leaveSharedWorkspace,
  listActiveInvitations,
  listWorkspaceMembers,
  listVisibleDocuments,
  openSharedWorkspace,
  removeMember,
  renameSharedDocument,
  renameSharedWorkspace,
  revokeInvitation,
  validInvitationEmail,
  workspaceNameForOwner,
} from "@/features/collaboration/membership";
import { seedLiveblocksDocument } from "@/features/collaboration/liveblocks-document";
import { roomId } from "@/features/collaboration/shared-document";

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
    const { deliverInvitation } = await import("@/features/collaboration/invitation-email.server");
    return {
      invitationId: invitation.invitationId,
      ...(await deliverInvitation({
        to: invitation.email,
        workspaceName,
        role,
        url,
      })),
    };
  } catch {
    return {
      invitationId: invitation.invitationId,
      delivery: "link" as const,
      url,
      invitationError: "Email delivery is unavailable. Share the invitation link instead.",
    };
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
  const identity = await auth({
    acceptsToken: ["session_token", "oauth_token"],
  });
  const userId = "userId" in identity ? identity.userId : null;
  if (!identity.isAuthenticated || !userId)
    return { error: Response.json({ error: "Sign in required" }, { status: 401, headers }) };
  if (
    identity.tokenType === "oauth_token" &&
    !("scopes" in identity && identity.scopes.includes("profile"))
  )
    return {
      error: Response.json(
        { error: "Desktop token lacks profile scope" },
        { status: 403, headers },
      ),
    };
  return { userId };
}

export const Route = createFileRoute("/api/shared-projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const started = performance.now();
        const current = await actor();
        const authenticated = performance.now();
        const json = (body: unknown, status = 200) =>
          Response.json(body, {
            status,
            headers: {
              ...headers,
              "Server-Timing": `auth;dur=${(authenticated - started).toFixed(1)}, database;dur=${(performance.now() - authenticated).toFixed(1)}`,
            },
          });
        if ("error" in current && current.error) return current.error;
        const url = new URL(request.url);
        const invitationWorkspace = url.searchParams.get("workspaceId");
        if (invitationWorkspace && url.searchParams.get("invitations") === "1") {
          try {
            const invitations = await withCollaborationDb((db) =>
              listActiveInvitations(db, invitationWorkspace, current.userId),
            );
            return json(invitations);
          } catch {
            return json({ error: "No access to invitations" }, 403);
          }
        }
        if (invitationWorkspace && url.searchParams.get("members") === "1") {
          try {
            const members = await withCollaborationDb((db) =>
              listWorkspaceMembers(db, invitationWorkspace, current.userId),
            );
            return json(members);
          } catch {
            return json({ error: "No access to members" }, 403);
          }
        }
        const documentId = url.searchParams.get("documentId");
        if (documentId) {
          // Open from Postgres only. Pulling every Liveblocks Yjs room here was 2 API
          // round-trips per file before the page could render; the workbench binds the
          // live rooms after mount and replaces these snapshots once synced.
          const opened = await withCollaborationDb((db) =>
            openSharedWorkspace(db, documentId, current.userId),
          );
          if (!opened) return json({ error: "No access to this document" }, 403);
          const { access, documents: files } = opened;
          return json({
            documentId,
            workspaceId: access.workspaceId,
            workspaceName: access.workspaceName,
            name: access.name,
            source: files.find((file) => file.id === documentId)?.source ?? access.source,
            role: access.role,
            documents: files,
          });
        }
        const documents = await withCollaborationDb((db) =>
          listVisibleDocuments(db, current.userId),
        );
        return json(documents);
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
              created.documents.map((file) =>
                seedLiveblocksDocument(liveblocks, file.id, file.source),
              ),
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
          if (body.action === "rename-workspace") {
            const renamed = await withCollaborationDb((db) =>
              renameSharedWorkspace(db, {
                workspaceId: text("workspaceId"),
                actorId: current.userId,
                name: text("name"),
              }),
            );
            return Response.json(renamed, { headers });
          }
          if (body.action === "leave-workspace") {
            await withCollaborationDb((db) =>
              leaveSharedWorkspace(db, {
                workspaceId: text("workspaceId"),
                actorId: current.userId,
              }),
            );
            return Response.json({ ok: true }, { headers });
          }
          if (body.action === "delete-workspace") {
            const documentIds = await withCollaborationDb((db) =>
              deleteSharedWorkspace(db, {
                workspaceId: text("workspaceId"),
                actorId: current.userId,
              }),
            );
            const liveblocks = new Liveblocks({ secret: process.env["LIVEBLOCKS_SECRET_KEY"]! });
            await Promise.allSettled(documentIds.map((id) => liveblocks.deleteRoom(roomId(id))));
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
          const status =
            /not active|expired|different account|Only the owner|The owner cannot|No access|invalid/i.test(
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
