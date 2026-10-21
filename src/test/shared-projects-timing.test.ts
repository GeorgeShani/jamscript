import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api.shared-projects";

const backend = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  members: vi.fn(),
  invitations: vi.fn(),
  management: vi.fn(),
  database: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start/server", () => ({ auth: backend.auth }));
vi.mock("@/features/collaboration/database", () => ({ withCollaborationDb: backend.database }));
vi.mock("@/features/collaboration/membership", async (original) => ({
  ...(await original<typeof import("@/features/collaboration/membership")>()),
  listVisibleDocuments: backend.list,
  listWorkspaceMembers: backend.members,
  listActiveInvitations: backend.invitations,
  listWorkspaceManagement: backend.management,
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
  backend.members.mockResolvedValue([]);
  backend.invitations.mockResolvedValue([]);
  backend.management.mockResolvedValue({ members: [], invitations: [] });
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
  it("loads management with one authentication check and one database connection", async () => {
    const response = await get("?workspaceId=private&management=1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ members: [], invitations: [] });
    expect(backend.auth).toHaveBeenCalledTimes(1);
    expect(backend.database).toHaveBeenCalledTimes(1);
    expect(backend.management).toHaveBeenCalledTimes(1);
    backend.management.mockRejectedValueOnce(new Error("Owner required"));
    backend.members.mockClear();
    expect((await get("?workspaceId=private&management=1")).status).toBe(403);
    expect(backend.members).not.toHaveBeenCalled();
  });
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
