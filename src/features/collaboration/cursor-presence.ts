import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect, type Extension } from "@codemirror/state";
import type { LiveblocksYjsProvider } from "@liveblocks/yjs";
import * as Y from "yjs";

import { presenceUserField } from "./presence";

type Awareness = LiveblocksYjsProvider["awareness"];

const peerPresenceRedraw = StateEffect.define<null>();

type CursorPayload = {
  anchor: ReturnType<typeof Y.relativePositionToJSON>;
  head: ReturnType<typeof Y.relativePositionToJSON>;
};

type AwarenessIdentity = { userId: string; name: string };

type AwarenessBag = {
  user?: ReturnType<typeof presenceUserObject>;
  cursor?: CursorPayload | null;
  activity?: { kind: string };
};

export function encodeCursor(ytext: Y.Text, anchor: number, head: number): CursorPayload {
  return {
    anchor: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(ytext, anchor)),
    head: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(ytext, head)),
  };
}

function presenceUserObject(identity: AwarenessIdentity) {
  const user = presenceUserField(identity);
  return {
    id: user.id,
    name: user.name,
    color: user.color,
    colorLight: user.colorLight,
    track: user.track,
  };
}

/**
 * Liveblocks awareness `setLocalStateField` rebuilds `__yjs` from `getSelf()?.presence`.
 * When that snapshot is empty (reconnect blip), a cursor-only write drops `user` and
 * peers fall back to y-codemirror's "Anonymous". Always rewrite the full bag with identity.
 */
export function writeAwarenessState(
  awareness: Awareness,
  identity: AwarenessIdentity,
  patch: AwarenessBag = {},
) {
  const current = (awareness.getLocalState() ?? {}) as AwarenessBag;
  awareness.setLocalState({
    ...current,
    ...patch,
    user: presenceUserObject(identity),
  } as never);
}

/** Keep Liveblocks `__yjs` presence populated so y-codemirror can publish carets. */
export function ensureAwarenessUser(awareness: Awareness, identity: AwarenessIdentity) {
  writeAwarenessState(awareness, identity);
  return presenceUserField(identity);
}

/**
 * Patch awareness mutators so y-codemirror cursor updates cannot wipe identity.
 * Call once per room attach; returns an undo that restores the originals.
 */
export function guardAwarenessIdentity(awareness: Awareness, identity: AwarenessIdentity) {
  const originalField = awareness.setLocalStateField.bind(awareness);
  const originalState = awareness.setLocalState.bind(awareness);

  awareness.setLocalState = ((state: Record<string, unknown> | null) => {
    if (state === null) {
      originalState(null);
      return;
    }
    originalState({
      ...state,
      user: presenceUserObject(identity),
    } as never);
  }) as Awareness["setLocalState"];

  awareness.setLocalStateField = ((field: string, value: unknown) => {
    const current = (awareness.getLocalState() ?? {}) as AwarenessBag;
    originalState({
      ...current,
      user: presenceUserObject(identity),
      [field]: value,
    } as never);
  }) as Awareness["setLocalStateField"];

  writeAwarenessState(awareness, identity);

  return () => {
    awareness.setLocalStateField = originalField;
    awareness.setLocalState = originalState;
  };
}

function paneVisible(view: EditorView) {
  const pane = view.dom.closest(".jam-editor-pane");
  return !pane || !pane.hasAttribute("hidden");
}

/**
 * Publish caret + selection through Liveblocks presence.
 * Streams drag/keyboard motion so peers see the range travel, not only a final `|`.
 */
const published = new WeakMap<Awareness, string>();

export function publishLocalCursor(
  awareness: Awareness,
  ytext: Y.Text,
  view: EditorView,
  identity: AwarenessIdentity,
  activity: "idle" | "moving" | "selecting" = "idle",
) {
  if (!ytext.doc) return;
  if (!paneVisible(view) && !view.hasFocus) {
    writeAwarenessState(awareness, identity);
    return;
  }
  const selection = view.state.selection.main;
  const selecting = !selection.empty;
  const motion = selecting ? "selecting" : activity === "moving" ? "moving" : "idle";
  // Mouse moves and key-ups repeat the same caret; peers only need the changes.
  const key = `${selection.anchor}:${selection.head}:${motion}:${ytext.length}`;
  if (published.get(awareness) === key) return;
  published.set(awareness, key);
  writeAwarenessState(awareness, identity, {
    cursor: encodeCursor(ytext, selection.anchor, selection.head),
    activity: { kind: motion },
  });
}

function resolvePeerHead(
  state: {
    cursor?: CursorPayload | null;
    user?: { color?: string; name?: string };
    activity?: { kind?: string } | string;
  },
  ytext: Y.Text,
  ydoc: Y.Doc,
) {
  const cursor = state.cursor;
  if (!cursor?.head) return null;
  const head = Y.createAbsolutePositionFromRelativePosition(
    Y.createRelativePositionFromJSON(cursor.head),
    ydoc,
  );
  if (!head || head.type !== ytext) return null;
  const activity =
    typeof state.activity === "string"
      ? state.activity
      : typeof state.activity?.kind === "string"
        ? state.activity.kind
        : "idle";
  return {
    head: head.index,
    color: state.user?.color || "#58B3F6",
    name: state.user?.name || "Collaborator",
    activity,
  };
}

/** Line stripe for each peer head — makes cursor travel readable beyond the thin caret. */
export function remotePeerPresence(awareness: Awareness, ytext: Y.Text): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      private view: EditorView | null = null;
      private readonly onAwareness = () => {
        this.view?.dispatch({ effects: peerPresenceRedraw.of(null) });
      };

      constructor(view: EditorView) {
        this.view = view;
        awareness.on("change", this.onAwareness);
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.transactions.some((transaction) =>
            transaction.effects.some((effect) => effect.is(peerPresenceRedraw)),
          )
        ) {
          this.decorations = this.build(update.view);
        }
      }

      destroy() {
        awareness.off("change", this.onAwareness);
        this.view = null;
      }

      build(view: EditorView) {
        if (!ytext.doc) return Decoration.none;
        const builder = new RangeSetBuilder<Decoration>();
        const ydoc = ytext.doc;
        const lines: { lineFrom: number; color: string; activity: string; name: string }[] = [];

        awareness.getStates().forEach((raw, clientId) => {
          if (clientId === awareness.doc.clientID) return;
          const peer = resolvePeerHead(
            raw as {
              cursor?: CursorPayload | null;
              user?: { color?: string; name?: string };
              activity?: string;
            },
            ytext,
            ydoc,
          );
          if (!peer) return;
          const line = view.state.doc.lineAt(
            Math.min(Math.max(peer.head, 0), view.state.doc.length),
          );
          lines.push({
            lineFrom: line.from,
            color: peer.color,
            activity: peer.activity,
            name: peer.name,
          });
        });

        const rank = (activity: string) =>
          activity === "selecting" ? 2 : activity === "moving" ? 1 : 0;
        lines.sort((a, b) => a.lineFrom - b.lineFrom || rank(b.activity) - rank(a.activity));
        let lastLine = -1;
        for (const line of lines) {
          if (line.lineFrom === lastLine) continue;
          lastLine = line.lineFrom;
          builder.add(
            line.lineFrom,
            line.lineFrom,
            Decoration.line({
              attributes: {
                class:
                  line.activity === "selecting"
                    ? "jam-peer-line is-selecting"
                    : line.activity === "moving"
                      ? "jam-peer-line is-moving"
                      : "jam-peer-line",
                style: `--jam-peer-color: ${line.color}`,
                "data-peer": line.name,
              },
            }),
          );
        }
        return builder.finish();
      }
    },
    { decorations: (value) => value.decorations },
  );
}

/** CodeMirror extension: stream caret/selection motion to peers and paint their line. */
export function localCursorPresence(
  awareness: Awareness,
  ytext: Y.Text,
  identity: AwarenessIdentity,
): Extension {
  let frame = 0;
  let pointerDown = false;
  const flush = (view: EditorView, activity: "idle" | "moving" | "selecting") => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      publishLocalCursor(awareness, ytext, view, identity, activity);
    });
  };

  return [
    remotePeerPresence(awareness, ytext),
    ViewPlugin.fromClass(
      class {
        constructor(view: EditorView) {
          publishLocalCursor(awareness, ytext, view, identity);
        }
        update(update: ViewUpdate) {
          if (update.selectionSet || update.focusChanged || update.docChanged) {
            const selecting = !update.state.selection.main.empty;
            flush(update.view, selecting ? "selecting" : "moving");
          }
        }
        destroy() {
          if (frame) cancelAnimationFrame(frame);
        }
      },
    ),
    EditorView.domEventHandlers({
      focus: (_event, view) => {
        publishLocalCursor(awareness, ytext, view, identity, "idle");
        return false;
      },
      pointerdown: (_event, view) => {
        pointerDown = true;
        flush(view, "moving");
        return false;
      },
      pointermove: (_event, view) => {
        if (!pointerDown && !view.hasFocus) return false;
        flush(view, view.state.selection.main.empty ? "moving" : "selecting");
        return false;
      },
      pointerup: (_event, view) => {
        pointerDown = false;
        flush(view, view.state.selection.main.empty ? "idle" : "selecting");
        return false;
      },
      keyup: (_event, view) => {
        flush(view, view.state.selection.main.empty ? "moving" : "selecting");
        return false;
      },
    }),
  ];
}
