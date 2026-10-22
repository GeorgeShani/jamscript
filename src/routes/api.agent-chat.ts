import { createFileRoute } from "@tanstack/react-router";
import { Liveblocks } from "@liveblocks/node";

import { agentContext } from "@/features/assistant/agent-context";
import { agentInstructions } from "@/features/assistant/agent-instructions";
import {
  formatAgentModelError,
  generateAgentText,
  agentConfigured,
  agentModelOptions,
  validateAgentModel,
  streamAgentText,
} from "@/features/assistant/agent-model";
import { parseAgentChatRequest } from "@/features/assistant/chat-request";
import { CHAT_LIMITS, type AgentChatFile } from "@/features/assistant/chat-types";
import { EDIT_RESPONSE_SCHEMA, parseStructuredEdit } from "@/features/assistant/structured-edit";
import { withCollaborationDb } from "@/features/collaboration/database";
import { readLiveblocksDocuments } from "@/features/collaboration/liveblocks-document";
import { openSharedWorkspace } from "@/features/collaboration/membership";
import { shareableDocumentName } from "@/features/collaboration/shareable";

const headers = {
  "Cache-Control": "private, no-store",
  // Desktop Tauri calls this Worker cross-origin; no cookies are required for local Ask/Edit.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

async function agentRateLimiter() {
  const { env } = await import("cloudflare:workers");
  return env.AGENT_RATE_LIMITER;
}

function ndjsonResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: { ...headers, "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}

function selectClientFiles(
  input: ReturnType<typeof parseAgentChatRequest>,
): AgentChatFile[] | null {
  if (!input.files?.length) return null;
  const byId = new Map(
    input.files.filter((file) => shareableDocumentName(file.name)).map((file) => [file.id, file]),
  );
  const selectedIds: string[] = [];
  const pushId = (id: string) => {
    if (byId.has(id) && !selectedIds.includes(id)) selectedIds.push(id);
  };
  pushId(input.documentId);
  for (const id of input.attachedDocumentIds ?? []) pushId(id);
  if (input.scope === "workspace")
    for (const file of input.files) {
      if (selectedIds.length >= CHAT_LIMITS.maxAttachedFiles) break;
      pushId(file.id);
    }
  const selected = selectedIds
    .map((id) => byId.get(id)!)
    .slice(0, input.scope === "active" && !input.attachedDocumentIds?.length ? 1 : 8);
  if (!selected.length) return null;
  if (
    selected.some((file) => file.source.length > CHAT_LIMITS.maxFileChars) ||
    selected.reduce((sum, file) => sum + file.source.length, 0) > CHAT_LIMITS.maxTotalSourceChars
  )
    return null;
  return selected;
}

export const Route = createFileRoute("/api/agent-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers }),
      GET: async () => {
        // Static deployment config, requested by both the workbench and the chat panel.
        // A short browser cache turns the second request and later mounts into hits.
        const cached = { ...headers, "Cache-Control": "private, max-age=300" };
        if (!agentConfigured()) return Response.json({ available: false }, { headers: cached });
        return Response.json({ available: true, models: agentModelOptions() }, { headers: cached });
      },
      POST: async ({ request }) => {
        const operationId = crypto.randomUUID();
        if (!agentConfigured())
          return Response.json(
            { error: "Workspace agent is not configured" },
            { status: 503, headers },
          );
        let userId: string | null = null;
        if (process.env["CLERK_SECRET_KEY"]) {
          try {
            const { auth } = await import("@clerk/tanstack-react-start/server");
            const session = await auth();
            if (session.isAuthenticated && session.userId) userId = session.userId;
          } catch {
            /* Local / misconfigured Clerk should not block local assistant chat. */
          }
        }
        if (Number(request.headers.get("content-length")) > 220_000)
          return Response.json({ error: "Request is too large" }, { status: 413, headers });
        let input;
        try {
          input = parseAgentChatRequest(await request.json());
          validateAgentModel(input.mode, input.model);
        } catch (cause) {
          return Response.json(
            { error: cause instanceof Error ? cause.message : "Invalid request" },
            { status: 400, headers },
          );
        }

        const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        const rateKey =
          userId ?? request.headers.get("cf-connecting-ip") ?? forwarded ?? "anonymous";
        try {
          const limiter = await agentRateLimiter();
          if (limiter) {
            const allowed = (await limiter.limit({ key: rateKey })).success;
            if (!allowed)
              return Response.json(
                { error: "Chat limit reached. Try again in a minute." },
                { status: 429, headers },
              );
          }
        } catch {
          /* Rate limiter binding may be absent in local/dev. */
        }

        let files: AgentChatFile[] | null = null;
        const canUseShared =
          !!userId && !!process.env["DATABASE_URL"] && !!process.env["LIVEBLOCKS_SECRET_KEY"];
        if (canUseShared) {
          const opened = await withCollaborationDb((db) =>
            openSharedWorkspace(db, input.documentId, userId!),
          );
          if (opened?.access.role === "viewer" && input.mode === "edit")
            return Response.json({ error: "Editing access required" }, { status: 403, headers });
          if (opened) {
            const eligible = opened.documents.filter((file) => shareableDocumentName(file.name));
            const byId = new Map(eligible.map((file) => [file.id, file]));
            const selectedIds: string[] = [];
            const pushId = (id: string) => {
              if (byId.has(id) && !selectedIds.includes(id)) selectedIds.push(id);
            };
            pushId(input.documentId);
            for (const id of input.attachedDocumentIds ?? []) pushId(id);
            if (input.scope === "workspace")
              for (const file of eligible) {
                if (selectedIds.length >= CHAT_LIMITS.maxAttachedFiles) break;
                pushId(file.id);
              }
            const selected = selectedIds
              .map((id) => byId.get(id)!)
              .slice(0, input.scope === "active" && !input.attachedDocumentIds?.length ? 1 : 8);
            if (
              selected.length &&
              !selected.some((file) => file.source.length > CHAT_LIMITS.maxFileChars)
            ) {
              const liveblocks = new Liveblocks({
                secret: process.env["LIVEBLOCKS_SECRET_KEY"]!,
              });
              try {
                files = await readLiveblocksDocuments(liveblocks, selected);
              } catch {
                files = null;
              }
            }
          }
        }
        if (!files) files = selectClientFiles(input);
        if (!files?.length)
          return Response.json({ error: "No eligible source files" }, { status: 400, headers });
        if (
          files.reduce((sum, file) => sum + file.source.length, 0) > CHAT_LIMITS.maxTotalSourceChars
        )
          return Response.json(
            { error: "Workspace is too large for one chat turn" },
            { status: 400, headers },
          );

        const abort = new AbortController();
        request.signal.addEventListener("abort", () => abort.abort(), { once: true });
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: object) => {
              if (!abort.signal.aborted)
                controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            };
            try {
              send({ type: "status", message: "Reading files", operationId });
              const latest = input.messages.at(-1)!;
              const context = agentContext(latest.content, files!);
              const systemInstruction = agentInstructions(input.mode);
              send({ type: "status", message: "Generating reply", operationId });
              const userPayload = {
                mode: input.mode,
                scope: input.scope,
                selection: input.selection ?? null,
                messages: input.messages,
                files,
                context,
              };
              if (input.mode === "edit") {
                const output = await generateAgentText({
                  mode: "edit",
                  ...(input.model ? { model: input.model } : {}),
                  systemInstruction,
                  userPayload,
                  signal: abort.signal,
                  jsonSchema: EDIT_RESPONSE_SCHEMA,
                });
                if (abort.signal.aborted) return;
                if (output.length > CHAT_LIMITS.maxResponseChars)
                  throw new Error("Agent response is too large");
                const proposal = parseStructuredEdit(output, files!);
                send({ type: "text-delta", text: proposal.summary });
                send({ type: "proposal", proposal });
              } else {
                let received = false;
                let responseChars = 0;
                for await (const text of streamAgentText({
                  mode: "ask",
                  ...(input.model ? { model: input.model } : {}),
                  systemInstruction,
                  userPayload,
                  signal: abort.signal,
                })) {
                  if (abort.signal.aborted) break;
                  if (!text) continue;
                  received = true;
                  responseChars += text.length;
                  if (responseChars > CHAT_LIMITS.maxResponseChars)
                    throw new Error("Agent response is too large");
                  send({ type: "text-delta", text });
                }
                if (abort.signal.aborted) return;
                if (!received) throw new Error("Empty agent response");
              }
              send({
                type: "done",
                seenDocumentIds: files!.map((file) => file.id),
                operationId,
              });
            } catch (cause) {
              if (!abort.signal.aborted)
                send({
                  type: "error",
                  message: formatAgentModelError(cause),
                });
            } finally {
              if (!abort.signal.aborted) controller.close();
            }
          },
          cancel() {
            abort.abort();
          },
        });
        return ndjsonResponse(stream);
      },
    },
  },
});
