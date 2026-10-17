import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  documentRevisions,
  documents,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { canWrite, type CollaborationRole } from "./shared-document";

export type CollaborationDb = Pick<
  PostgresJsDatabase,
  "insert" | "select" | "update" | "delete"
>;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createSharedProject(
  db: CollaborationDb,
  input: { name: string; ownerId: string; documentName: string; source: string },
) {
  const name = input.name.trim();
  const documentName = input.documentName.trim();
  if (!name || !documentName) throw new Error("Workspace and document names are required");
  const [workspace] = await db
    .insert(workspaces)
    .values({ name, createdByClerkUserId: input.ownerId })
    .returning();
  if (!workspace) throw new Error("Workspace was not created");
  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    clerkUserId: input.ownerId,
    role: "owner",
  });
  const [document] = await db
    .insert(documents)
    .values({ workspaceId: workspace.id, name: documentName, source: input.source })
    .returning();
  if (!document) throw new Error("Document was not created");
  await db.insert(documentRevisions).values({
    documentId: document.id,
    version: 1,
    source: input.source,
    savedByClerkUserId: input.ownerId,
  });
  return { workspaceId: workspace.id, documentId: document.id, role: "owner" as const };
}

export async function memberRole(db: CollaborationDb, workspaceId: string, userId: string) {
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.clerkUserId, userId)),
    );
  return member?.role ?? null;
}

export async function listVisibleDocuments(db: CollaborationDb, userId: string) {
  return db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      documentId: documents.id,
      documentName: documents.name,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .innerJoin(documents, eq(documents.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.clerkUserId, userId));
}

export async function roleForDocument(db: CollaborationDb, documentId: string, userId: string) {
  const [document] = await db
    .select({ workspaceId: documents.workspaceId, source: documents.source, name: documents.name })
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!document) return null;
  const role = await memberRole(db, document.workspaceId, userId);
  if (!role) return null;
  return { ...document, role };
}

export async function createInvitation(
  db: CollaborationDb,
  input: { workspaceId: string; actorId: string; email: string; role: "editor" | "viewer" },
) {
  const role = await memberRole(db, input.workspaceId, input.actorId);
  if (role !== "owner") throw new Error("Only the owner can invite");
  if (!canWrite(input.role) && input.role !== "viewer") throw new Error("Invalid invitation role");
  const email = normalizeEmail(input.email);
  if (email.length < 4 || !email.includes("@")) throw new Error("Invitation email is invalid");
  const token = randomBytes(32).toString("hex");
  const [invitation] = await db
    .insert(workspaceInvitations)
    .values({
      workspaceId: input.workspaceId,
      invitedEmail: email,
      role: input.role,
      tokenHash: hashInviteToken(token),
      invitedByClerkUserId: input.actorId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning({ id: workspaceInvitations.id });
  if (!invitation) throw new Error("Invitation was not created");
  return { invitationId: invitation.id, token, email, role: input.role };
}

export async function revokeInvitation(
  db: CollaborationDb,
  input: { invitationId: string; actorId: string },
) {
  const [invitation] = await db
    .select({
      workspaceId: workspaceInvitations.workspaceId,
      acceptedAt: workspaceInvitations.acceptedAt,
    })
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.id, input.invitationId));
  if (!invitation) throw new Error("Invitation was not found");
  if ((await memberRole(db, invitation.workspaceId, input.actorId)) !== "owner")
    throw new Error("Only the owner can revoke an invitation");
  if (invitation.acceptedAt) throw new Error("Accepted invitations stay on the membership record");
  await db
    .update(workspaceInvitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(workspaceInvitations.id, input.invitationId), isNull(workspaceInvitations.revokedAt)));
}

export async function acceptInvitation(
  db: CollaborationDb,
  input: { token: string; userId: string; email: string },
) {
  const email = normalizeEmail(input.email);
  const [invitation] = await db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.tokenHash, hashInviteToken(input.token)));
  if (!invitation || invitation.revokedAt || invitation.acceptedAt) throw new Error("Invitation is not active");
  if (invitation.expiresAt.getTime() <= Date.now()) throw new Error("Invitation has expired");
  if (invitation.invitedEmail !== email) throw new Error("This invitation is for a different account");
  const existing = await memberRole(db, invitation.workspaceId, input.userId);
  if (!existing) {
    await db.insert(workspaceMembers).values({
      workspaceId: invitation.workspaceId,
      clerkUserId: input.userId,
      role: invitation.role,
    });
  }
  await db
    .update(workspaceInvitations)
    .set({ acceptedAt: new Date(), acceptedByClerkUserId: input.userId })
    .where(eq(workspaceInvitations.id, invitation.id));
  const [document] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.workspaceId, invitation.workspaceId));
  return {
    workspaceId: invitation.workspaceId,
    documentId: document?.id ?? null,
    role: existing ?? invitation.role,
  };
}

export async function removeMember(
  db: CollaborationDb,
  input: { workspaceId: string; actorId: string; memberId: string },
) {
  if ((await memberRole(db, input.workspaceId, input.actorId)) !== "owner")
    throw new Error("Only the owner can remove a member");
  if (input.actorId === input.memberId) throw new Error("The owner cannot remove themselves");
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.clerkUserId, input.memberId),
      ),
    );
}

export function liveblocksAccess(role: CollaborationRole) {
  return canWrite(role) ? (["*:write"] as const) : (["*:read"] as const);
}
