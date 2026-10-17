import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Clerk owns accounts. Only verified Clerk user IDs are stored here; there is no local password table.
export const jamScriptSchema = pgSchema("jamscript");

export const workspaces = jamScriptSchema.table(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("workspace_name_nonempty", sql`length(trim(${table.name})) > 0`)],
);

export const workspaceMembers = jamScriptSchema.table(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: text("role").$type<"owner" | "editor" | "viewer">().notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.clerkUserId] }),
    check("workspace_member_role_valid", sql`${table.role} in ('owner', 'editor', 'viewer')`),
    uniqueIndex("workspace_one_owner_idx")
      .on(table.workspaceId)
      .where(sql`${table.role} = 'owner'`),
    index("workspace_members_user_idx").on(table.clerkUserId),
  ],
);

export const documents = jamScriptSchema.table(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: text("source").default("").notNull(),
    sourceVersion: integer("source_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("documents_workspace_name_idx").on(table.workspaceId, table.name),
    check("document_name_nonempty", sql`length(trim(${table.name})) > 0`),
    check("document_source_version_positive", sql`${table.sourceVersion} > 0`),
  ],
);

// Invitations store only a hash of the bearer token. Acceptance must verify the invited email.
export const workspaceInvitations = jamScriptSchema.table(
  "workspace_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email").notNull(),
    role: text("role").$type<"editor" | "viewer">().notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByClerkUserId: text("invited_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByClerkUserId: text("accepted_by_clerk_user_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("workspace_invitations_token_hash_idx").on(table.tokenHash),
    index("workspace_invitations_workspace_idx").on(table.workspaceId),
    index("workspace_invitations_email_idx").on(table.invitedEmail),
    check("workspace_invitation_role_valid", sql`${table.role} in ('editor', 'viewer')`),
    check(
      "workspace_invitation_email_normalized",
      sql`length(${table.invitedEmail}) > 3 and ${table.invitedEmail} = lower(trim(${table.invitedEmail}))`,
    ),
    check("workspace_invitation_token_hash_valid", sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check("workspace_invitation_expiry_valid", sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      "workspace_invitation_acceptance_complete",
      sql`(${table.acceptedAt} is null) = (${table.acceptedByClerkUserId} is null)`,
    ),
    check(
      "workspace_invitation_not_accepted_and_revoked",
      sql`${table.acceptedAt} is null or ${table.revokedAt} is null`,
    ),
  ],
);

// A revision is an immutable saved snapshot, not every keystroke or a Liveblocks update.
export const documentRevisions = jamScriptSchema.table(
  "document_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    source: text("source").notNull(),
    savedByClerkUserId: text("saved_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("document_revisions_document_version_idx").on(table.documentId, table.version),
    check("document_revision_version_positive", sql`${table.version} > 0`),
  ],
);
