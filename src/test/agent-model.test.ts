import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
  formatAgentModelError,
  resolveGeminiModel,
} from "@/features/assistant/agent-model";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("agent model resolution", () => {
  it("defaults to gemini-3.8-flash and rejects redundant 2.5-flash", () => {
    vi.stubEnv("GEMINI_MODEL", "");
    expect(resolveGeminiModel()).toBe(DEFAULT_GEMINI_MODEL);
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
    expect(resolveGeminiModel()).toBe(DEFAULT_GEMINI_MODEL);
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    expect(resolveGeminiModel()).toBe("gemini-3.8-flash");
  });

  it("explains denied Gemini projects, busy models, and retired 2.5 models", () => {
    expect(
      formatAgentModelError(new Error("PERMISSION_DENIED Your project has been denied access")),
    ).toMatch(/AI Studio|billing|API key/i);
    expect(
      formatAgentModelError(
        new Error("UNAVAILABLE This model is currently experiencing high demand"),
      ),
    ).toMatch(/busy|retry/i);
    expect(
      formatAgentModelError(
        new Error("This model models/gemini-2.5-flash is no longer available to new users"),
      ),
    ).toContain(DEFAULT_GEMINI_MODEL);
  });
});
