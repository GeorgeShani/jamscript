import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches workspace, library and help pages under /app", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/app").at(-1)?.routeId).toBe("/app/");
    expect(router.matchRoutes("/app/workspaces/local-123").at(-1)?.routeId).toBe(
      "/app/workspaces/$workspaceId",
    );
    expect(router.matchRoutes("/app/help").at(-1)?.routeId).toBe("/app/help");
    expect(router.matchRoutes("/app/library").at(-1)?.routeId).toBe("/app/library");
  });
});
