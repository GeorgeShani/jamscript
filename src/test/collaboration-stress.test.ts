// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  canWrite,
  createLocalUndo,
  localEditOrigin,
  seedSharedText,
  sharedSource,
} from "@/features/collaboration/shared-document";

function reconcile(left: Y.Doc, right: Y.Doc) {
  const leftUpdate = Y.encodeStateAsUpdate(left);
  const rightUpdate = Y.encodeStateAsUpdate(right);
  Y.applyUpdate(left, rightUpdate, "remote");
  Y.applyUpdate(right, leftUpdate, "remote");
}

describe("concurrent shared editing", () => {
  it("reconciles sustained offline edits and keeps local undo away from another editor's work", () => {
    const stored = new Y.Doc();
    expect(seedSharedText(stored, 's("bd")')).toBe(true);
    const owner = new Y.Doc();
    const editor = new Y.Doc();
    const initial = Y.encodeStateAsUpdate(stored);
    Y.applyUpdate(owner, initial);
    Y.applyUpdate(editor, initial);
    const ownerUndo = createLocalUndo(owner);

    for (let index = 0; index < 40; index++) {
      ownerUndo.stopCapturing();
      owner.transact(
        () => owner.getText("source").insert(owner.getText("source").length, `\n// owner ${index}`),
        localEditOrigin,
      );
      editor.getText("source").insert(editor.getText("source").length, `\n// editor ${index}`);
      if (index % 9 === 0) reconcile(owner, editor);
    }

    reconcile(owner, editor);
    expect(sharedSource(owner)).toBe(sharedSource(editor));
    for (let index = 0; index < 40; index++) {
      expect(sharedSource(owner)).toContain(`// owner ${index}`);
      expect(sharedSource(owner)).toContain(`// editor ${index}`);
    }

    ownerUndo.undo();
    reconcile(owner, editor);
    expect(sharedSource(owner)).toBe(sharedSource(editor));
    expect(sharedSource(owner)).not.toContain("// owner 39");
    expect(sharedSource(owner)).toContain("// editor 39");

    const reopened = new Y.Doc();
    Y.applyUpdate(reopened, Y.encodeStateAsUpdate(owner));
    expect(seedSharedText(reopened, 's("wrong duplicate")')).toBe(false);
    expect(sharedSource(reopened)).toBe(sharedSource(owner));
    expect(canWrite("viewer")).toBe(false);
    expect(canWrite("editor")).toBe(true);
    ownerUndo.destroy();
    owner.destroy();
    editor.destroy();
    stored.destroy();
    reopened.destroy();
  });
});
