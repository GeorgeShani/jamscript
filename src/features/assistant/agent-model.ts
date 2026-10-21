import { GoogleGenAI } from "@google/genai";
import {
  generateOpenRouterText,
  streamOpenRouterText,
  openRouterKey,
  OpenRouterError,
  type AssistantMode,
  resolveOpenRouterModels,
} from "./openrouter.server";

/** Current Flash model for new projects. Do not default to gemini-2.5-flash. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function resolveGeminiModel() {
  const configured = (process.env["GEMINI_MODEL"] || "").trim();
  if (!configured) return DEFAULT_GEMINI_MODEL;
  if (/^gemini-2\.5-flash/i.test(configured)) return DEFAULT_GEMINI_MODEL;
  return configured;
}

export function geminiConfigured() {
  return !!process.env["GEMINI_API_KEY"];
}

export function agentConfigured() {
  return !!openRouterKey() || geminiConfigured();
}

export function agentModelOptions() {
  return openRouterKey()
    ? { ask: resolveOpenRouterModels("ask"), edit: resolveOpenRouterModels("edit") }
    : { ask: [], edit: [] };
}

export function validateAgentModel(mode: AssistantMode, model?: string) {
  if (model && (!openRouterKey() || !resolveOpenRouterModels(mode).includes(model)))
    throw new Error("Choose a model from the configured assistant list.");
}

/** Turn opaque SDK/HTTP failures into an actionable UI message. */
export function formatAgentModelError(cause: unknown): string {
  if (cause instanceof OpenRouterError) return cause.message;
  const parts: string[] = [];
  const walk = (value: unknown, depth = 0) => {
    if (depth > 4 || value == null) return;
    if (typeof value === "string") {
      parts.push(value);
      return;
    }
    if (value instanceof Error) {
      parts.push(value.message);
      walk((value as Error & { cause?: unknown }).cause, depth + 1);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["message", "status", "statusText", "code", "error"]) {
        if (key in record) walk(record[key], depth + 1);
      }
    }
  };
  walk(cause);
  const text = parts.join(" ");

  if (/denied access|PERMISSION_DENIED/i.test(text))
    return "Gemini API access is denied for this Google project. In AI Studio, attach billing or create a new project and API key, then set GEMINI_API_KEY.";
  if (/high demand|UNAVAILABLE|try again later|503|RESOURCE_EXHAUSTED|quota/i.test(text))
    return "Gemini is busy right now. Wait a few seconds and retry.";
  if (/no longer available to new users|gemini-2\.5-flash/i.test(text))
    return `Gemini 2.5 Flash is unavailable for new projects. Set GEMINI_MODEL=${DEFAULT_GEMINI_MODEL}.`;
  if (/NOT_FOUND|is not found|not found for API version/i.test(text))
    return `That Gemini model is unavailable. Set GEMINI_MODEL=${DEFAULT_GEMINI_MODEL}.`;
  if (/API key|INVALID_ARGUMENT|401|unauthenticated/i.test(text))
    return "Gemini API key is invalid or missing. Set GEMINI_API_KEY on the Worker.";
  if (/Agent proposed no changes/i.test(text))
    return "The assistant proposed no file changes. Describe the change more specifically.";
  if (/Invalid agent response|Invalid proposal file/i.test(text))
    return "The assistant returned a proposal that could not be reviewed. Try again.";
  if (cause instanceof Error && cause.message.startsWith("Agent response")) return cause.message;
  if (cause instanceof Error && cause.message.startsWith("Proposal")) return cause.message;
  if (cause instanceof Error && cause.message.startsWith("Edit mode")) return cause.message;
  return "Agent chat failed. Check the Gemini model configuration and try again.";
}

function isTransientGeminiFailure(cause: unknown) {
  const text = cause instanceof Error ? cause.message : String(cause ?? "");
  return /high demand|UNAVAILABLE|try again later|503|RESOURCE_EXHAUSTED|quota|ECONNRESET|ETIMEDOUT/i.test(
    text,
  );
}

export async function* streamGeminiText(input: {
  apiKey: string;
  systemInstruction: string;
  userPayload: unknown;
  signal: AbortSignal;
}): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: input.apiKey });
  const model = resolveGeminiModel();
  const request = {
    model,
    contents: JSON.stringify(input.userPayload),
    config: {
      abortSignal: input.signal,
      automaticContinuation: false,
      maxOutputTokens: 8192,
      systemInstruction: input.systemInstruction,
    },
  };
  let lastError: unknown;
  let emitted = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (input.signal.aborted) return;
    try {
      const chunks = await ai.models.generateContentStream(request);
      for await (const chunk of chunks) {
        if (input.signal.aborted) return;
        const text = chunk.text ?? "";
        if (text) {
          emitted = true;
          yield text;
        }
      }
      return;
    } catch (cause) {
      lastError = cause;
      // Once text is visible, restarting would concatenate two different answers.
      if (emitted || attempt === 2 || !isTransientGeminiFailure(cause) || input.signal.aborted)
        throw cause;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function generateGeminiText(input: {
  apiKey: string;
  systemInstruction: string;
  userPayload: unknown;
  signal: AbortSignal;
  jsonSchema?: Record<string, unknown>;
}) {
  const ai = new GoogleGenAI({ apiKey: input.apiKey });
  const request = {
    model: resolveGeminiModel(),
    contents: JSON.stringify(input.userPayload),
    config: {
      abortSignal: input.signal,
      automaticContinuation: false,
      maxOutputTokens: 8192,
      systemInstruction: input.systemInstruction,
      ...(input.jsonSchema
        ? { responseMimeType: "application/json", responseJsonSchema: input.jsonSchema }
        : {}),
    },
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (input.signal.aborted) throw lastError ?? new Error("Generation stopped.");
    try {
      const response = await ai.models.generateContent(request);
      return response.text ?? "";
    } catch (cause) {
      lastError = cause;
      if (attempt === 2 || !isTransientGeminiFailure(cause) || input.signal.aborted) throw cause;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

/** Prefer OpenRouter; retain direct Gemini for existing installations without its key. */
export async function* streamAgentText(input: {
  model?: string;
  mode?: AssistantMode;
  jsonSchema?: Record<string, unknown>;
  systemInstruction: string;
  userPayload: unknown;
  signal: AbortSignal;
}): AsyncGenerator<string> {
  if (openRouterKey()) {
    yield* streamOpenRouterText({ ...input, mode: input.mode ?? "ask" });
    return;
  }
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("Gemini API key is invalid or missing.");
  yield* streamGeminiText({
    apiKey: key,
    systemInstruction: input.systemInstruction,
    userPayload: input.userPayload,
    signal: input.signal,
  });
}

/** Generate a reviewable proposal using the configured Edit model chain. */
export async function generateAgentText(input: {
  model?: string;
  mode?: AssistantMode;
  systemInstruction: string;
  userPayload: unknown;
  signal: AbortSignal;
  jsonSchema?: Record<string, unknown>;
}) {
  if (openRouterKey()) return generateOpenRouterText({ ...input, mode: input.mode ?? "edit" });
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("Gemini API key is invalid or missing.");
  return generateGeminiText({
    apiKey: key,
    systemInstruction: input.systemInstruction,
    userPayload: input.userPayload,
    signal: input.signal,
    ...(input.jsonSchema ? { jsonSchema: input.jsonSchema } : {}),
  });
}
