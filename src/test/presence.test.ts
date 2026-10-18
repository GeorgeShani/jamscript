import { describe, expect, it } from "vitest";

import {
  aggregatePresence,
  presenceColorFor,
  presenceInitials,
  presenceUserField,
  readSharedPresence,
} from "@/features/collaboration/presence";

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
