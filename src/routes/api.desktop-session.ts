import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/desktop-session")({
  server: {
    handlers: {
      GET: async () => {
        const headers = { "Cache-Control": "private, no-store" };
        if (!process.env["CLERK_SECRET_KEY"])
          return Response.json({ error: "Sign-in is not configured" }, { status: 503, headers });
        const { auth, clerkClient } = await import("@clerk/tanstack-react-start/server");
        const identity = await auth({
          acceptsToken: "oauth_token",
        });
        const userId = "userId" in identity ? identity.userId : null;
        if (
          !identity.isAuthenticated ||
          !userId ||
          identity.tokenType !== "oauth_token" ||
          !("scopes" in identity && identity.scopes.includes("profile"))
        )
          return Response.json({ error: "Desktop sign-in required" }, { status: 401, headers });
        const user = await clerkClient().users.getUser(userId);
        return Response.json(
          {
            id: userId,
            name: user.fullName || user.username || user.firstName || "Musician",
            email:
              user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
                ?.emailAddress ?? null,
            imageUrl: user.imageUrl || null,
          },
          { headers },
        );
      },
    },
  },
});
