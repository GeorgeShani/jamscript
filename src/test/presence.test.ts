import { describe, expect, it } from "vitest";

import {
  encodeCursor,
  writeAwarenessState,
} from "@/features/collaboration/cursor-presence";
import {
  aggregatePresence,
  presenceColorFor,
  presenceInitials,
  presenceUserField,
  readSharedPresence,
} from "@/features/collaboration/presence";
import * as Y from "yjs";

describe("collaboration presence", () => {
  it("assigns a stable track colour from a user id", () => {
    expect(presenceColorFor("user_alice")).toEqual(presenceColorFor("user_alice"));
    expect(presenceColorFor("user_alice").track).toBeGreaterThanOrEqual(1);
    expect(presenceColorFor("user_alice").track).toBeLessThanOrEqual(6);
  });

  it("builds initials and the y-codemirror user field", () => {
    expect(presenceInitials("Ada Lovelace")).toBe("AL");
    expect(presenceInitials("nk")).toBe("NK");
    const user = presenceUserField({ userId: "user_1", name: "Nico" });
    expect(user).toMatchObject({
      id: "user_1",
      name: "Nico",
      color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
      colorLight: expect.stringMatching(/^#[0-9A-Fa-f]{8}$/),
    });
  });

  it("reads remote awareness peers and skips the local client", () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: { id: "me", name: "Me", color: "#58B3F6", track: 1 } }],
      [2, { user: { id: "them", name: "Taylor", color: "#ED7EC7", track: 2 } }],
      [3, { name: "Legacy" }],
    ]);
    expect(readSharedPresence(states, 1)).toEqual([
      {
        id: "them",
        clientId: "2",
        name: "Taylor",
        color: "#ED7EC7",
        track: 2,
      },
      {
        id: "3",
        clientId: "3",
        name: "Legacy",
        color: presenceColorFor("Legacy").color,
        track: presenceColorFor("Legacy").track,
      },
    ]);
  });

  it("always rewrites identity when publishing awareness so cursor updates cannot drop the name", () => {
    const states: Record<string, unknown>[] = [];
    const awareness = {
      getLocalState: () => states.at(-1) ?? null,
      setLocalState: (state: Record<string, unknown> | null) => {
        if (state) states.push(state);
      },
    };
    writeAwarenessState(awareness as never, { userId: "user_a", name: "Ada" }, {
      cursor: { anchor: { tname: "source" }, head: { tname: "source" } },
    });
    // Simulate y-codemirror's cursor-only field write path by publishing again
    // with only a cursor patch against an empty local snapshot.
    awareness.getLocalState = () => null;
    writeAwarenessState(awareness as never, { userId: "user_a", name: "Ada" }, {
      cursor: { anchor: { tname: "source" }, head: { tname: "source" } },
    });
    expect(states.at(-1)).toMatchObject({
      user: { id: "user_a", name: "Ada" },
      cursor: { anchor: { tname: "source" } },
    });
  });

  it("encodes caret and selection ends as Liveblocks-safe JSON relative positions", () => {
    const doc = new Y.Doc();
    const text = doc.getText("source");
    text.insert(0, "note(c3)");
    const caret = encodeCursor(text, 2, 2);
    const selection = encodeCursor(text, 2, 5);
    expect(caret.anchor).toMatchObject({ tname: "source" });
    expect(selection.head).toMatchObject({ tname: "source" });
    expect(JSON.parse(JSON.stringify(selection))).toEqual(selection);
    expect(selection.anchor).not.toEqual(selection.head);
  });

  it("aggregates peers across open documents without duplicating a user", () => {
    const byDocument: Array<[string, ReturnType<typeof readSharedPresence>]> = [
      [
        "bass",
        [
          {
            id: "user_a",
            clientId: "1",
            name: "Ada",
            color: "#58B3F6",
            track: 1,
          },
        ],
      ],
      [
        "drums",
        [
          {
            id: "user_a",
            clientId: "9",
            name: "Ada",
            color: "#58B3F6",
            track: 1,
          },
          {
            id: "user_b",
            clientId: "2",
            name: "Gus",
            color: "#ED7EC7",
            track: 2,
          },
        ],
      ],
    ];
    expect(aggregatePresence(byDocument, (id) => (id === "bass" ? "bass.js" : "drums.js"))).toEqual(
      [
        {
          id: "user_a",
          clientId: "1",
          name: "Ada",
          color: "#58B3F6",
          track: 1,
          documentName: "bass.js",
        },
        {
          id: "user_b",
          clientId: "2",
          name: "Gus",
          color: "#ED7EC7",
          track: 2,
          documentName: "drums.js",
        },
      ],
    );
  });
});
