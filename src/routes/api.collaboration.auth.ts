import { createFileRoute } from "@tanstack/react-router";
import { Liveblocks } from "@liveblocks/node";

import { withCollaborationDb } from "@/features/collaboration/database";
import { liveblocksAccess, roleForDocument } from "@/features/collaboration/membership";
import { documentIdFromRoom } from "@/features/collaboration/shared-document";

const headers = { "Cache-Control": "private, no-store" };

export const Route = createFileRoute("/api/collaboration/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env["LIVEBLOCKS_SECRET_KEY"] || !process.env["CLERK_SECRET_KEY"])
          return Response.json({ error: "Collaboration is not configured" }, { status: 503, headers });
        const { auth } = await import("@clerk/tanstack-react-start/server");
        const { userId, isAuthenticated } = await auth();
        if (!isAuthenticated || !userId)
          return Response.json({ error: "Sign in required" }, { status: 401, headers });
        const body = (await request.json()) as { room?: unknown };
        const room = typeof body.room === "string" ? body.room : "";
        const documentId = documentIdFromRoom(room);
        if (!documentId) return Response.json({ error: "Unknown room" }, { status: 403, headers });
        const access = await withCollaborationDb((db) => roleForDocument(db, documentId, userId));
        if (!access) return Response.json({ error: "No access to this document" }, { status: 403, headers });
        const liveblocks = new Liveblocks({ secret: process.env["LIVEBLOCKS_SECRET_KEY"] });
        const session = liveblocks.prepareSession(userId, { userInfo: { name: access.role } });
        session.allow(room, liveblocksAccess(access.role));
        const authorized = await session.authorize();
        return new Response(authorized.body, {
          status: authorized.status,
          headers: { "Content-Type": "application/json", ...headers },
        });
      },
    },
  },
});
