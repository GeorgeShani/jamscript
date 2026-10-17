CREATE SCHEMA "jamscript";
--> statement-breakpoint
CREATE TABLE "jamscript"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"source_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_name_nonempty" CHECK (length(trim("jamscript"."documents"."name")) > 0),
	CONSTRAINT "document_source_version_positive" CHECK ("jamscript"."documents"."source_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "jamscript"."workspace_members" (
	"workspace_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_clerk_user_id_pk" PRIMARY KEY("workspace_id","clerk_user_id"),
	CONSTRAINT "workspace_member_role_valid" CHECK ("jamscript"."workspace_members"."role" in ('owner', 'editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "jamscript"."workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_name_nonempty" CHECK (length(trim("jamscript"."workspaces"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "jamscript"."documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "jamscript"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jamscript"."workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "jamscript"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_workspace_name_idx" ON "jamscript"."documents" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_one_owner_idx" ON "jamscript"."workspace_members" USING btree ("workspace_id") WHERE "jamscript"."workspace_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "jamscript"."workspace_members" USING btree ("clerk_user_id");