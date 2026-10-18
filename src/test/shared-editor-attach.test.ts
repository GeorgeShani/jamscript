import { afterEach, describe, expect, it, vi } from "vitest";
import { Compartment, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import * as Y from "yjs";

import {
  createMusicEditor,
  dispatchLensEdit,
  dispatchMusicHistory,
  musicModel,
} from "@/components/jam/code-editor";
import { bindSharedEditor } from "@/features/collaboration/binding";
import { createLocalUndo, seedSharedText } from "@/features/collaboration/shared-document";

afterEach(() => {
  document.body.innerHTML = "";
});

function editor(source: string, doc: Y.Doc, role: "editor" | "viewer" = "editor") {
  const mount = document.createElement("div");
  document.body.append(mount);
  const view = createMusicEditor(mount, source, vi.fn(), vi.fn());
  const binding = new Compartment();
  const undo = createLocalUndo(doc);
  view.dispatch({
    effects: StateEffect.appendConfig.of(binding.of(EditorView.editable.of(false))),
  });
  bindSharedEditor(view, doc, null, role, undo, binding);
  return { view, undo };
}

describe("shared source controls", () => {
  it("aligns a stale local snapshot before binding the shared source", () => {
    const doc = new Y.Doc();
    seedSharedText(doc, 's("bd ~ sd ~")');
    const { view, undo } = editor('s("old")', doc);
    expect(view.state.doc.toString()).toBe('s("bd ~ sd ~")');
    doc.getText("source").insert(doc.getText("source").length, ".gain(0.5)");
    expect(view.state.doc.toString()).toBe('s("bd ~ sd ~").gain(0.5)');
    undo.destroy();
    view.destroy();
    doc.destroy();
  });

  it("sends a knob patch to a second editor and derives its control value", () => {
    const source = 'drums: s("bd ~ sd ~").gain(0.5);';
    const ownerDoc = new Y.Doc();
    seedSharedText(ownerDoc, source);
    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, Y.encodeStateAsUpdate(ownerDoc));
    const sendOwner = (update: Uint8Array) => Y.applyUpdate(peerDoc, update, "remote");
    const sendPeer = (update: Uint8Array) => Y.applyUpdate(ownerDoc, update, "remote");
    ownerDoc.on("update", sendOwner);
    peerDoc.on("update", sendPeer);
    const owner = editor(source, ownerDoc);
    const peer = editor(source, peerDoc);

    expect(dispatchLensEdit(owner.view, { target: "drums/param/gain", value: 0.8 })).toBe(true);
    expect(peer.view.state.doc.toString()).toContain("gain(0.8)");
    const remoteLens = peer.view.state
      .field(musicModel)
      .tracks.flatMap((track) => track.lenses)
      .find((lens) => lens.id === "drums/param/gain");
    expect(remoteLens).toMatchObject({ value: 0.8 });
    peerDoc.getText("source").insert(peerDoc.getText("source").length, "\n// peer change");
    expect(dispatchMusicHistory(owner.view, false)).toBe(true);
    expect(peer.view.state.doc.toString()).toContain("gain(0.5)");
    expect(peer.view.state.doc.toString()).toContain("// peer change");
    expect(dispatchLensEdit(owner.view, { target: "drums/rhythm", step: 1 })).toBe(true);
    expect(peer.view.state.doc.toString()).toContain('s("bd bd sd ~")');
    const viewer = editor(peer.view.state.doc.toString(), peerDoc, "viewer");
    expect(dispatchLensEdit(viewer.view, { target: "drums/param/gain", value: 0.9 })).toBe(false);

    ownerDoc.off("update", sendOwner);
    peerDoc.off("update", sendPeer);
    owner.undo.destroy();
    peer.undo.destroy();
    viewer.undo.destroy();
    owner.view.destroy();
    peer.view.destroy();
    viewer.view.destroy();
    ownerDoc.destroy();
    peerDoc.destroy();
  });
});
