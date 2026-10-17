import { describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api.shared-workspaces";

const clerk = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@clerk/tanstack-react-start/server", () => clerk);

describe("shared workspace metadata route", () => {
  it("rejects an anonymous caller before opening the database", async () => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_example");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_example");
    clerk.auth.mockResolvedValue({ userId: null, isAuthenticated: false });
    const handlers = Route.options.server?.handlers;
    if (typeof handlers === "function") throw new Error("Expected simple route handlers");
    const handler = handlers?.GET;
    expect(handler).toBeDefined();
    const response = await handler!({} as never);
    if (!(response instanceof Response)) throw new Error("Expected an HTTP response");
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Sign in required" });
    vi.unstubAllEnvs();
  });
});
