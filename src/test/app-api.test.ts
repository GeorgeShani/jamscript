import { afterEach, describe, expect, it, vi } from "vitest";

describe("apiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns same-origin paths in the browser", async () => {
    vi.stubEnv("JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN", "");
    const { apiUrl } = await import("@/lib/app-api");
    expect(apiUrl("/api/agent-chat")).toBe("/api/agent-chat");
  });

  it("prefixes the desktop Worker origin when configured", async () => {
    vi.stubEnv("JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN", "https://jamscript.example.workers.dev/");
    const { apiUrl } = await import("@/lib/app-api");
    expect(apiUrl("/api/agent-chat")).toBe("https://jamscript.example.workers.dev/api/agent-chat");
  });
});
