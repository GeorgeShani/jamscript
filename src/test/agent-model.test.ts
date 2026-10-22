import { describe, expect, it } from "vitest";

import { formatAgentModelError } from "@/features/assistant/agent-model";

describe("agent model errors", () => {
  it("explains busy models and missing keys", () => {
    expect(
      formatAgentModelError(
        new Error("UNAVAILABLE This model is currently experiencing high demand"),
      ),
    ).toMatch(/busy|retry/i);
    expect(formatAgentModelError(new Error("401 unauthenticated"))).toMatch(/OPENROUTER_API_KEY/);
  });
});
