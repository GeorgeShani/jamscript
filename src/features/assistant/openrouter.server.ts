import { createParser } from "eventsource-parser";

export type AssistantMode = "ask" | "edit";
export const DEFAULT_OPENROUTER_MODELS = {
  ask: ["openai/gpt-6-luna", "anthropic/claude-sonnet-5.5", "google/gemini-3.8-flash"],
  edit: ["openai/gpt-6-sol", "anthropic/claude-sonnet-5.5", "google/gemini-3.8-flash"],
} as const;

export class OpenRouterError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export function openRouterKey() {
  return process.env["OPENROUTER_API_KEY"]?.trim();
}

export function resolveOpenRouterModels(mode: AssistantMode, preferred?: string) {
  const name = mode === "ask" ? "OPENROUTER_ASK_MODELS" : "OPENROUTER_EDIT_MODELS";
  const raw = process.env[name]?.trim();
  const models = raw
    ? [...new Set(raw.split(",").map((model) => model.trim()))]
    : [...DEFAULT_OPENROUTER_MODELS[mode]];
  if (models.length > 5 || models.some((model) => !/^[\w.-]+\/[\w.:-]+$/.test(model)))
    throw new OpenRouterError(
      400,
      `Invalid ${name}. Set a comma-separated list of up to five provider/model IDs.`,
    );
  if (preferred && !models.includes(preferred))
    throw new OpenRouterError(400, "Choose a model from the configured assistant list.");
  return preferred ? [preferred, ...models.filter((model) => model !== preferred)] : models;
}

export interface OpenRouterInput {
  mode: AssistantMode;
  model?: string;
  systemInstruction: string;
  userPayload: unknown;
  signal: AbortSignal;
  jsonSchema?: Record<string, unknown>;
}

function providerError(status: number): OpenRouterError {
  const messages: Record<number, string> = {
    401: "OpenRouter rejected the server API key. Check OPENROUTER_API_KEY.",
    402: "OpenRouter credits or the API key spending limit are exhausted. Add credits or adjust the limit.",
    403: "OpenRouter denied this request. Check the key permissions and model access settings.",
    400: "OpenRouter rejected the assistant configuration. Check the model IDs and supported parameters.",
    404: "No configured OpenRouter model endpoint is available. Check the Ask/Edit model settings.",
    408: "The assistant request timed out. Try again.",
    429: "The configured AI models are rate-limited. Try again shortly.",
    504: "The assistant request timed out. Try again.",
  };
  return new OpenRouterError(
    status,
    messages[status] ?? "The configured AI models are unavailable right now. Try again shortly.",
  );
}

type Completion = {
  error?: { code?: number };
  choices?: {
    finish_reason?: string | null;
    message?: { content?: unknown };
    delta?: { content?: unknown };
  }[];
};

function completion(value: unknown): Completion {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new OpenRouterError(502, "The assistant returned an invalid response. Try again.");
  const data = value as Completion;
  if (data.error) throw providerError(typeof data.error.code === "number" ? data.error.code : 502);
  if (
    data.choices !== undefined &&
    (!Array.isArray(data.choices) ||
      data.choices.some((choice) => !choice || typeof choice !== "object"))
  )
    throw new OpenRouterError(502, "The assistant returned an invalid response. Try again.");
  return data;
}

function checkFinish(reason: string | null | undefined) {
  if (reason && reason !== "stop")
    throw new OpenRouterError(
      502,
      reason === "length"
        ? "The assistant response reached its length limit. Ask for a smaller change."
        : "The assistant could not complete this response. Try a different request.",
    );
}

async function request(input: OpenRouterInput, stream: boolean) {
  const key = openRouterKey();
  if (!key)
    throw new OpenRouterError(401, "Set OPENROUTER_API_KEY on the server to enable the assistant.");
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(90_000)]);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://jamscript.dev",
      "X-Title": "JamScript",
    },
    body: JSON.stringify({
      models: resolveOpenRouterModels(input.mode, input.model),
      messages: [
        { role: "system", content: input.systemInstruction },
        { role: "user", content: JSON.stringify(input.userPayload) },
      ],
      stream,
      max_tokens: 8192,
      provider: {
        allow_fallbacks: true,
        ...(input.jsonSchema ? { require_parameters: true } : {}),
      },
      ...(input.jsonSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: "workspace_proposal", strict: true, schema: input.jsonSchema },
            },
          }
        : {}),
    }),
  }).catch((cause: unknown) => {
    if (input.signal.aborted) throw input.signal.reason;
    if (signal.aborted) throw providerError(504);
    throw new OpenRouterError(
      502,
      "Could not reach OpenRouter. Check the connection and try again.",
    );
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw providerError(response.status);
  }
  return response;
}

/** The ordered `models` list delegates pre-response fallback to OpenRouter. */
export async function generateOpenRouterText(input: OpenRouterInput) {
  try {
    const response = await request(input, false);
    const data = completion(await response.json());
    const choice = data.choices?.[0];
    checkFinish(choice?.finish_reason);
    const text = choice?.message?.content;
    if (typeof text !== "string" || !text.trim())
      throw new OpenRouterError(502, "The assistant returned an empty response. Try again.");
    if (text.length > 500_000) throw new OpenRouterError(502, "Agent response is too large");
    return text;
  } catch (cause) {
    if (input.signal.aborted) throw input.signal.reason;
    if (cause instanceof OpenRouterError) throw cause;
    throw new OpenRouterError(502, "The assistant response was interrupted. Try again.");
  }
}

/** Never restart a partial answer: it would mix output from different models. */
export async function* streamOpenRouterText(input: OpenRouterInput): AsyncGenerator<string> {
  const response = await request(input, true);
  if (!response.body)
    throw new OpenRouterError(502, "The assistant returned an empty response. Try again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let received = false;
  let size = 0;
  const texts: string[] = [];
  let wireSize = 0;
  const parser = createParser({
    onEvent(event) {
      if (event.data === "[DONE]") {
        done = true;
        return;
      }
      const data = completion(JSON.parse(event.data));
      const choice = data.choices?.[0];
      checkFinish(choice?.finish_reason);
      const text = choice?.delta?.content;
      if (text != null && typeof text !== "string")
        throw new OpenRouterError(502, "The assistant returned an invalid response. Try again.");
      if (text) {
        size += text.length;
        if (size > 500_000) throw new OpenRouterError(502, "Agent response is too large");
        received = true;
        texts.push(text);
      }
    },
  });
  try {
    while (!done) {
      input.signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) {
        parser.feed(decoder.decode());
        break;
      }
      wireSize += chunk.value.byteLength;
      if (wireSize > 2_000_000) throw new OpenRouterError(502, "Agent response is too large");
      parser.feed(decoder.decode(chunk.value, { stream: true }));
      for (const text of texts.splice(0)) yield text;
    }
    if (!done || !received)
      throw new OpenRouterError(502, "The assistant response was interrupted. Try again.");
  } catch (cause) {
    if (input.signal.aborted) throw input.signal.reason;
    if (cause instanceof OpenRouterError) throw cause;
    throw new OpenRouterError(502, "The assistant response was interrupted. Try again.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
