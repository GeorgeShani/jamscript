import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamGeminiText } from "@/features/assistant/agent-model";

const sdk = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContentStream: sdk.stream };
  },
}));
const input = () => ({
  apiKey: "test-only",
  systemInstruction: "Answer",
  userPayload: {},
  signal: new AbortController().signal,
});
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("Gemini streaming retries", () => {
  it("does not append a restarted reply after a partial answer", async () => {
    sdk.stream.mockImplementation(async function* () {
      yield { text: "The kick " };
      throw new Error("503 UNAVAILABLE");
    });
    const chunks: string[] = [];
    await expect(
      (async () => {
        for await (const text of streamGeminiText(input())) chunks.push(text);
      })(),
    ).rejects.toThrow("UNAVAILABLE");
    expect(chunks).toEqual(["The kick "]);
    expect(sdk.stream).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure before any text reaches the user", async () => {
    sdk.stream.mockRejectedValueOnce(new Error("503 UNAVAILABLE"));
    sdk.stream.mockImplementationOnce(async function* () {
      yield { text: "A clean answer" };
    });
    const chunks: string[] = [];
    for await (const text of streamGeminiText(input())) chunks.push(text);
    expect(chunks).toEqual(["A clean answer"]);
    expect(sdk.stream).toHaveBeenCalledTimes(2);
  });
});
