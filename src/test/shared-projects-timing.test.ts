import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api.shared-projects";

const backend = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  members: vi.fn(),
  database: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start/server", () => ({ auth: backend.auth }));
vi.mock("@/features/collaboration/database", () => ({ withCollaborationDb: backend.database }));
vi.mock("@/features/collaboration/membership", async (original) => ({
  ...(await original<typeof import("@/features/collaboration/membership")>()),
  listVisibleDocuments: backend.list,
  listWorkspaceMembers: backend.members,
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ["CLERK_SECRET_KEY", "DATABASE_URL", "LIVEBLOCKS_SECRET_KEY"])
    vi.stubEnv(name, "test-only");
  backend.auth.mockResolvedValue({
    userId: "user_test",
    isAuthenticated: true,
    tokenType: "session_token",
  });
  backend.database.mockImplementation((run: (db: object) => unknown) => run({}));
  backend.list.mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function get(query = "") {
  const handlers = Route.options.server?.handlers;
  if (!handlers || typeof handlers === "function" || !handlers.GET)
    throw new Error("Missing GET handler");
  const response = await handlers.GET({
    request: new Request(`https://jamscript.test/api/shared-projects${query}`),
  } as never);
  if (!(response instanceof Response)) throw new Error("Expected response");
  return response;
}

describe("shared project latency visibility", () => {
  it("reports auth separately from database work without caching private results", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Server-Timing")).toMatch(
      /^auth;dur=\d+\.\d, database;dur=\d+\.\d$/,
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Server-Timing")).not.toContain("user_test");
  });
  it("preserves permission checks and never opens the database for anonymous users", async () => {
    backend.auth.mockResolvedValue({ isAuthenticated: false });
    expect((await get()).status).toBe(401);
    expect(backend.database).not.toHaveBeenCalled();
    backend.auth.mockResolvedValue({ userId: "outsider", isAuthenticated: true });
    backend.members.mockRejectedValue(new Error("No access"));
    expect((await get("?workspaceId=private&members=1")).status).toBe(403);
  });
});
