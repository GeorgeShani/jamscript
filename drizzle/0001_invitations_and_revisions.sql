CREATE TABLE "jamscript"."document_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"source" text NOT NULL,
	"saved_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_revision_version_positive" CHECK ("jamscript"."document_revisions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "jamscript"."workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invited_email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_clerk_user_id" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "workspace_invitation_role_valid" CHECK ("jamscript"."workspace_invitations"."role" in ('editor', 'viewer')),
	CONSTRAINT "workspace_invitation_email_normalized" CHECK (length("jamscript"."workspace_invitations"."invited_email") > 3 and "jamscript"."workspace_invitations"."invited_email" = lower(trim("jamscript"."workspace_invitations"."invited_email"))),
	CONSTRAINT "workspace_invitation_token_hash_valid" CHECK ("jamscript"."workspace_invitations"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workspace_invitation_expiry_valid" CHECK ("jamscript"."workspace_invitations"."expires_at" > "jamscript"."workspace_invitations"."created_at"),
	CONSTRAINT "workspace_invitation_acceptance_complete" CHECK (("jamscript"."workspace_invitations"."accepted_at" is null) = ("jamscript"."workspace_invitations"."accepted_by_clerk_user_id" is null)),
	CONSTRAINT "workspace_invitation_not_accepted_and_revoked" CHECK ("jamscript"."workspace_invitations"."accepted_at" is null or "jamscript"."workspace_invitations"."revoked_at" is null)
);
--> statement-breakpoint
ALTER TABLE "jamscript"."document_revisions" ADD CONSTRAINT "document_revisions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "jamscript"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jamscript"."workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "jamscript"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_revisions_document_version_idx" ON "jamscript"."document_revisions" USING btree ("document_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_token_hash_idx" ON "jamscript"."workspace_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_idx" ON "jamscript"."workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invitations_email_idx" ON "jamscript"."workspace_invitations" USING btree ("invited_email");