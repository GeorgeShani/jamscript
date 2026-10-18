/** Track-palette colours for collaborator cursors and avatars (DESIGN.md). */
export const PRESENCE_COLORS = [
  { track: 1, color: "#58B3F6", colorLight: "#58B3F633" },
  { track: 2, color: "#ED7EC7", colorLight: "#ED7EC733" },
  { track: 3, color: "#55B577", colorLight: "#55B57733" },
  { track: 4, color: "#C7BC1C", colorLight: "#C7BC1C33" },
  { track: 5, color: "#E19678", colorLight: "#E1967833" },
  { track: 6, color: "#EABDFE", colorLight: "#EABDFE33" },
] as const;

export type PresencePalette = (typeof PRESENCE_COLORS)[number];

export interface SharedPresence {
  id: string;
  clientId: string;
  name: string;
  color: string;
  track: number;
}

export interface PresenceUserField {
  id?: string;
  name?: string;
  color?: string;
  colorLight?: string;
  track?: number;
}

export function presenceColorFor(seed: string): PresencePalette {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1)
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length]!;
}

export function presenceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  const compact = parts[0] ?? "?";
  return compact.slice(0, 2).toUpperCase();
}

export function presenceUserField(input: { userId: string; name: string }): PresenceUserField & {
  id: string;
  name: string;
  color: string;
  colorLight: string;
  track: number;
} {
  const palette = presenceColorFor(input.userId || input.name);
  return {
    id: input.userId,
    name: input.name,
    color: palette.color,
    colorLight: palette.colorLight,
    track: palette.track,
  };
}

/** Read remote peers from a Yjs awareness snapshot (excludes the local client). */
export function readSharedPresence(
  states: Iterable<[number, Record<string, unknown>]>,
  localClientId: number,
): SharedPresence[] {
  const people: SharedPresence[] = [];
  for (const [clientId, state] of states) {
    if (clientId === localClientId) continue;
    const user = (state["user"] ?? null) as PresenceUserField | null;
    const fallbackName = typeof state["name"] === "string" ? state["name"] : undefined;
    const name = user?.name || fallbackName || "Collaborator";
    const seed = user?.id || name;
    const palette = presenceColorFor(seed);
    people.push({
      id: user?.id || String(clientId),
      clientId: String(clientId),
      name,
      color: user?.color || palette.color,
      track: user?.track || palette.track,
    });
  }
  return people;
}

/** One avatar per signed-in user; keep the first sighting's document label. */
export function aggregatePresence(
  byDocument: Iterable<[string, SharedPresence[]]>,
  documentName: (documentId: string) => string | undefined,
): Array<SharedPresence & { documentName?: string }> {
  const seen = new Map<string, SharedPresence & { documentName?: string }>();
  for (const [documentId, people] of byDocument) {
    const label = documentName(documentId);
    for (const person of people) {
      if (seen.has(person.id)) continue;
      seen.set(person.id, label ? { ...person, documentName: label } : person);
    }
  }
  return [...seen.values()];
}
