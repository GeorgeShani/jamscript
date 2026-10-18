export type SlashCommand = "explain" | "fix" | "clear";

export function parseSlashCommand(input: string): { command: SlashCommand; rest: string } | null {
  const match = /^\/(explain|fix|clear)(?:\s+([\s\S]*))?$/i.exec(input.trim());
  if (!match) return null;
  return {
    command: match[1]!.toLowerCase() as SlashCommand,
    rest: (match[2] ?? "").trim(),
  };
}

export function expandSlashPrompt(
  command: SlashCommand,
  rest: string,
  context: { selection: string; problems: string },
): string | null {
  if (command === "clear") return null;
  if (command === "explain") {
    const target = rest || context.selection || "the active file";
    return `Explain this Strudel code clearly:\n\n${target}`;
  }
  const focus = rest || context.problems || context.selection || "the active file";
  return `Fix this Strudel issue. Prefer a minimal change:\n\n${focus}`;
}

export const STARTER_PROMPTS = [
  "Explain what this file plays, section by section",
  "Suggest a quieter variation of the hats without changing the kick",
  "What Problems should I fix first in this source?",
] as const;

export const EDIT_STARTER_PROMPTS = [
  "Make the hats busier while keeping the kick unchanged",
  "Add a bass part that fits this groove",
  "Simplify the pattern without changing its tempo",
] as const;

export const NEW_SONG_PROMPTS = [
  "Create a simple drum groove at 120 BPM with labeled tracks",
  "Start a mellow bass and chord sketch at 90 BPM",
] as const;
