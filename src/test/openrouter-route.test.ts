// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/api.agent-chat";
import { DEFAULT_OPENROUTER_MODELS } from "@/features/assistant/openrouter.server";

const transport = vi.fn<typeof fetch>();
beforeEach(() => {
  transport.mockReset();
  vi.stubGlobal("fetch", transport);
  for (const name of [
    "CLERK_SECRET_KEY",
    "DATABASE_URL",
    "LIVEBLOCKS_SECRET_KEY",
    "OPENROUTER_ASK_MODELS",
    "OPENROUTER_EDIT_MODELS",
    "GEMINI_API_KEY",
  ])
    vi.stubEnv(name, "");
  vi.stubEnv("OPENROUTER_API_KEY", "test-only");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function chat(mode: "ask" | "edit") {
  const handlers = Route.options.server?.handlers;
  if (!handlers || typeof handlers === "function" || !handlers.POST)
    throw new Error("Missing handler");
  const response = await handlers.POST({
    request: new Request("https://jamscript.test/api/agent-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: "local",
        documentId: "song",
        mode,
        scope: "active",
        files: [{ id: "song", name: "song.js", source: 's("bd").gain(0.5)' }],
        messages: [
          { role: "user", content: mode === "ask" ? "Explain the kick" : "Lower gain to 0.4" },
        ],
      }),
    }),
  } as never);
  if (!(response instanceof Response)) throw new Error("Missing response");
  expect(response.status).toBe(200);
  return (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

it("streams actual Ask handler output through the OpenRouter adapter with Strudel context", async () => {
  transport.mockResolvedValue(
    new Response(
      'data: {"choices":[{"delta":{"content":"The kick plays each cycle."}}]}\n\ndata: [DONE]\n\n',
      { headers: { "Content-Type": "text/event-stream" } },
    ),
  );
  const events = await chat("ask");
  expect(events).toContainEqual({ type: "text-delta", text: "The kick plays each cycle." });
  expect(events.some((event) => event.type === "proposal")).toBe(false);
  expect(events.at(-1)).toMatchObject({ type: "done", seenDocumentIds: ["song"] });
  const body = JSON.parse(transport.mock.calls[0]![1]!.body as string);
  expect(body.models).toEqual(DEFAULT_OPENROUTER_MODELS.ask);
  const payload = JSON.parse(body.messages[1].content);
  expect(payload.context).toBeTruthy();
  expect(payload.files[0].source).toBe('s("bd").gain(0.5)');
});

it("returns a validated Edit proposal from the actual handler without applying it", async () => {
  transport.mockResolvedValue(
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Lower gain",
              files: [
                { documentId: "song", source: 's("bd").gain(0.4)', explanation: "Quieter kick" },
              ],
            }),
          },
          finish_reason: "stop",
        },
      ],
    }),
  );
  const events = await chat("edit");
  const proposed = events.find((event) => event.type === "proposal");
  expect(proposed.proposal.files[0]).toMatchObject({
    documentId: "song",
    proposedSource: 's("bd").gain(0.4)',
  });
  expect(events.at(-1)).toMatchObject({ type: "done" });
  const body = JSON.parse(transport.mock.calls[0]![1]!.body as string);
  expect(body.models).toEqual(DEFAULT_OPENROUTER_MODELS.edit);
  expect(body.response_format.json_schema.strict).toBe(true);
});

it("rejects client models outside the server allowlist before calling OpenRouter", async () => {
  const handlers = Route.options.server?.handlers;
  if (!handlers || typeof handlers === "function" || !handlers.POST)
    throw new Error("Missing handler");
  const response = await handlers.POST({
    request: new Request("https://jamscript.test/api/agent-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: "test",
        documentId: "song",
        mode: "ask",
        model: "unapproved/expensive-model",
        scope: "active",
        messages: [{ role: "user", content: "Hello" }],
      }),
    }),
  } as never);
  expect(response).toBeInstanceOf(Response);
  expect((response as Response).status).toBe(400);
  expect(transport).not.toHaveBeenCalled();
});
