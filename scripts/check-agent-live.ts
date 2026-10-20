import { createNdjsonParser } from "../src/features/assistant/chat-stream";
import type { AgentChatEvent } from "../src/features/assistant/chat-types";
import { proposalSyntaxCheck } from "../src/features/assistant/agent-context";

// Opt-in live smoke check; sends synthetic music only and never writes project files.
const origin = process.argv[2] ?? "http://127.0.0.1:5173";
const source = '// Keep this groove\ns("bd").gain(0.42)';
const files = [{ id: "fixture-song", name: "song.js", source }];
for (const mode of ["ask", "edit"] as const) {
  const started = performance.now();
  const response = await fetch(new URL("/api/agent-chat", origin), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      threadId: `live-check-${crypto.randomUUID()}`,
      documentId: "fixture-song",
      mode,
      scope: "active",
      files,
      messages: [
        {
          role: "user",
          content:
            mode === "ask"
              ? "What sound and gain are used in song.js? Answer in one sentence including the gain number."
              : "Change ONLY the gain from 0.42 to 0.3. Preserve every other character including the comment.",
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${mode}: HTTP ${response.status}`);
  const events: AgentChatEvent[] = [];
  const parser = createNdjsonParser((event) => events.push(event));
  parser.push(await response.text());
  parser.flush();
  const error = events.find((event) => event.type === "error");
  if (error?.type === "error") throw new Error(`${mode}: ${error.message}`);
  if (!events.some((event) => event.type === "done")) throw new Error(`${mode}: incomplete stream`);
  const reply = events
    .filter((event) => event.type === "text-delta")
    .map((event) => (event.type === "text-delta" ? event.text : ""))
    .join("");
  const proposal = events.find((event) => event.type === "proposal");
  if (mode === "ask" && (!reply.includes("0.42") || !reply.includes("bd") || proposal))
    throw new Error("Ask did not answer the fixture question correctly");
  if (mode === "edit") {
    if (proposal?.type !== "proposal" || proposal.proposal.files.length !== 1)
      throw new Error("Edit did not return one reviewed file");
    const file = proposal.proposal.files[0]!;
    if (
      file.baseSource !== source ||
      file.proposedSource !== source.replace("0.42", "0.3") ||
      !proposalSyntaxCheck(files, proposal.proposal.files)
    )
      throw new Error("Edit changed unrelated text or returned invalid source");
  }
  console.log(`${mode.toUpperCase()} passed in ${Math.round(performance.now() - started)}ms`);
}
