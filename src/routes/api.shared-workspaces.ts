import { createFileRoute } from "@tanstack/react-router";
import { withCollaborationDb } from "@/features/collaboration/database";

/** Authenticated metadata only; document content stays behind later room permissions. */
export const Route = createFileRoute("/api/shared-workspaces")({
  server: {
    handlers: {
      GET: async () => {
        const headers = { "Cache-Control": "private, no-store" };
        if (!import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] || !process.env["CLERK_SECRET_KEY"])
          return Response.json({ error: "Sign-in is not configured" }, { status: 503, headers });
        const { auth } = await import("@clerk/tanstack-react-start/server");
        const { userId, isAuthenticated } = await auth();
        if (!isAuthenticated || !userId)
          return Response.json({ error: "Sign in required" }, { status: 401, headers });

        const url = process.env["DATABASE_URL"];
        if (!url)
          return Response.json(
            { error: "Shared workspaces are not configured" },
            { status: 503, headers },
          );

        const [{ eq }, schema] = await Promise.all([import("drizzle-orm"), import("@/db/schema")]);
        const rows = await withCollaborationDb((db) =>
          db
            .select({
              id: schema.workspaces.id,
              name: schema.workspaces.name,
              role: schema.workspaceMembers.role,
              updatedAt: schema.workspaces.updatedAt,
            })
            .from(schema.workspaceMembers)
            .innerJoin(
              schema.workspaces,
              eq(schema.workspaces.id, schema.workspaceMembers.workspaceId),
            )
            .where(eq(schema.workspaceMembers.clerkUserId, userId)),
        );
        return Response.json(rows, { headers });
      },
    },
  },
});
