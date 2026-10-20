// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api.agent-chat";
import { createNdjsonParser } from "@/features/assistant/chat-stream";
import type { AgentChatEvent } from "@/features/assistant/chat-types";

const backend = vi.hoisted(() => ({
  generate: vi.fn(),
  stream: vi.fn(),
  auth: vi.fn(),
  role: vi.fn(),
}));
vi.mock("@/features/assistant/agent-model", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/assistant/agent-model")>()),
  geminiConfigured: () => true,
  generateAgentText: backend.generate,
  streamAgentText: backend.stream,
}));
vi.mock("@clerk/tanstack-react-start/server", () => ({ auth: backend.auth }));
vi.mock("@/features/collaboration/database", () => ({
  withCollaborationDb: (run: (db: object) => unknown) => run({}),
}));
vi.mock("@/features/collaboration/membership", () => ({
  roleForDocument: backend.role,
  listWorkspaceDocuments: vi.fn(),
}));

const files = [{ id: "song", name: "song.js", source: '// Keep this groove\ns("bd").gain(0.42)' }];
const proposal = (source = files[0]!.source.replace("0.42", "0.3"), id = "song") =>
  JSON.stringify({
    summary: "Quieter kick",
    files: [{ documentId: id, source, explanation: "Lower gain" }],
  });

async function post(mode: "ask" | "edit", extra = {}) {
  const handlers = Route.options.server?.handlers;
  if (!handlers || typeof handlers === "function" || !handlers.POST)
    throw new Error("Missing chat handler");
  const request = new Request("https://jamscript.test/api/agent-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      threadId: "test",
      documentId: "song",
      mode,
      scope: "active",
      files,
      messages: [
        { role: "user", content: mode === "ask" ? "Explain the kick" : "Lower gain to 0.3" },
      ],
      ...extra,
    }),
  });
  const response = await handlers.POST({ request } as never);
  if (!(response instanceof Response)) throw new Error("Expected HTTP response");
  return response;
}
async function events(response: Response) {
  const result: AgentChatEvent[] = [];
  const parser = createNdjsonParser((event) => result.push(event));
  parser.push(await response.text());
  parser.flush();
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("LIVEBLOCKS_SECRET_KEY", "");
  backend.stream.mockImplementation(async function* () {
    yield "The kick uses gain 0.42.";
  });
  backend.generate.mockResolvedValue(proposal());
});
afterEach(() => vi.unstubAllEnvs());

describe("actual Ask/Edit HTTP handlers", () => {
  it("streams Ask with the selected source and never returns an edit proposal", async () => {
    const response = await post("ask");
    expect(response.status).toBe(200);
    expect(await events(response)).toEqual(
      expect.arrayContaining([
        { type: "text-delta", text: "The kick uses gain 0.42." },
        expect.objectContaining({ type: "done", seenDocumentIds: ["song"] }),
      ]),
    );
    expect(backend.stream.mock.calls[0]?.[0].userPayload.files).toEqual(files);
    expect(backend.generate).not.toHaveBeenCalled();
    expect(backend.stream.mock.calls[0]?.[0].systemInstruction).toContain("ASK MODE");
    expect(
      backend.stream.mock.calls[0]?.[0].userPayload.context.documentation.find(
        (item: { name: string }) => item.name === "gain",
      ).types.method,
    ).toContain("number");
  });

  it("returns a structured Edit proposal anchored to the exact source snapshot", async () => {
    const result = await events(await post("edit"));
    expect(result).toContainEqual({
      type: "proposal",
      proposal: {
        summary: "Quieter kick",
        files: [
          {
            documentId: "song",
            name: "song.js",
            baseSource: files[0]!.source,
            proposedSource: files[0]!.source.replace("0.42", "0.3"),
            explanation: "Lower gain",
          },
        ],
      },
    });
    expect(backend.generate.mock.calls[0]?.[0].jsonSchema).toBeDefined();
    expect(backend.generate.mock.calls[0]?.[0].systemInstruction).toContain("EDIT MODE");
    expect(backend.generate.mock.calls[0]?.[0].systemInstruction).toContain(
      "consistent indentation",
    );
    expect(backend.stream).not.toHaveBeenCalled();
  });

  it.each([
    ["syntax error", () => proposal('s("bd").gain(')],
    ["unauthorized file", () => proposal('s("hh")', "another-file")],
  ])("rejects a proposal with %s", async (_reason, output) => {
    backend.generate.mockResolvedValue(output());
    const result = await events(await post("edit"));
    expect(result.some((event) => event.type === "error")).toBe(true);
    expect(result.some((event) => event.type === "proposal" || event.type === "done")).toBe(false);
  });

  it("rejects shared viewer edits before calling Gemini", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "test");
    vi.stubEnv("DATABASE_URL", "test");
    vi.stubEnv("LIVEBLOCKS_SECRET_KEY", "test");
    backend.auth.mockResolvedValue({ isAuthenticated: true, userId: "viewer" });
    backend.role.mockResolvedValue({ role: "viewer", workspaceId: "workspace" });
    expect((await post("edit")).status).toBe(403);
    expect(backend.generate).not.toHaveBeenCalled();
  });
});
