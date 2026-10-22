import {
  generateOpenRouterText,
  streamOpenRouterText,
  openRouterKey,
  OpenRouterError,
  type AssistantMode,
  resolveOpenRouterModels,
} from "./openrouter.server";

export function agentConfigured() {
  return !!openRouterKey();
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

/** Turn opaque HTTP failures into an actionable UI message. */
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

  if (/high demand|UNAVAILABLE|try again later|503|RESOURCE_EXHAUSTED|quota/i.test(text))
    return "The assistant is busy right now. Wait a few seconds and retry.";
  if (/API key|INVALID_ARGUMENT|401|unauthenticated/i.test(text))
    return "The assistant API key is invalid or missing. Set OPENROUTER_API_KEY on the Worker.";
  if (/Agent proposed no changes/i.test(text))
    return "The assistant proposed no file changes. Describe the change more specifically.";
  if (/Invalid agent response|Invalid proposal file/i.test(text))
    return "The assistant returned a proposal that could not be reviewed. Try again.";
  if (cause instanceof Error && cause.message.startsWith("Agent response")) return cause.message;
  if (cause instanceof Error && cause.message.startsWith("Proposal")) return cause.message;
  if (cause instanceof Error && cause.message.startsWith("Edit mode")) return cause.message;
  return "Agent chat failed. Check the assistant configuration and try again.";
}

/** Stream assistant text through OpenRouter's configured model chain. */
export async function* streamAgentText(input: {
  model?: string;
  mode?: AssistantMode;
  jsonSchema?: Record<string, unknown>;
  systemInstruction: string;
  userPayload: unknown;
  signal: AbortSignal;
}): AsyncGenerator<string> {
  if (!openRouterKey()) throw new Error("The assistant API key is invalid or missing.");
  yield* streamOpenRouterText({ ...input, mode: input.mode ?? "ask" });
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
  if (!openRouterKey()) throw new Error("The assistant API key is invalid or missing.");
  return generateOpenRouterText({ ...input, mode: input.mode ?? "edit" });
}
