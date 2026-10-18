import { describe, expect, it } from "vitest";
import { agentContext, proposalSyntaxCheck } from "@/features/assistant/agent-context";

describe("agent context", () => {
  it("provides bounded offline documentation and parse diagnostics for authorized files", () => {
    const context = agentContext("Change the sound", [
      { id: "song", name: "song.js", source: 's("bd").fast(2)' },
      { id: "broken", name: "broken.js", source: "const x = (" },
    ]);
    expect(context.documentation.some((entry) => entry.name === "fast")).toBe(true);
    expect(context.diagnostics[0]?.problems).toEqual([]);
    expect(context.diagnostics[1]?.problems.length).toBeGreaterThan(0);
    expect(JSON.stringify(context)).not.toContain("secret.js");
  });

  it("rejects newly introduced syntax failures without evaluating music", () => {
    const files = [{ id: "song", name: "song.js", source: 's("bd")' }];
    expect(proposalSyntaxCheck(files, [{ documentId: "song", proposedSource: 's("sd")' }])).toBe(
      true,
    );
    expect(proposalSyntaxCheck(files, [{ documentId: "song", proposedSource: "s(" }])).toBe(false);
    expect(proposalSyntaxCheck(files, [{ documentId: "other", proposedSource: "s(1)" }])).toBe(
      false,
    );
  });
});
