import { afterEach, describe, expect, it, vi } from "vitest";
import { closeBracketsKeymap } from "@codemirror/autocomplete";
import { isolateHistory, redo, undo } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  createMusicEditor,
  dispatchLensEdit,
  flushLensEdits,
  musicModel,
} from "@/components/jam/code-editor";
import { SAMPLE_CODE } from "@/components/jam/session";
import { renameTrackPatch } from "@/engine/mix-source";
import { act } from "@testing-library/react";

const views: EditorView[] = [];
afterEach(async () => {
  await act(async () => {
    for (const view of views.splice(0)) view.destroy();
  });
  document.body.innerHTML = "";
});
function editor(code = SAMPLE_CODE, change = vi.fn()) {
  const parent = document.createElement("div");
  document.body.append(parent);
  let view!: EditorView;
  act(() => {
    view = createMusicEditor(parent, code, change, vi.fn());
  });
  views.push(view);
  return view;
}
/** Types through the editor's input handlers, as the browser does for each keystroke. */
function typeText(view: EditorView, text: string) {
  for (const character of text) {
    const { from, to } = view.state.selection.main;
    const insert = () =>
      view.state.update({
        changes: { from, to, insert: character },
        selection: { anchor: from + character.length },
        userEvent: "input.type",
      });
    const handled = view.state
      .facet(EditorView.inputHandler)
      .some((handler) => handler(view, from, to, character, insert));
    if (!handled) view.dispatch(insert());
  }
}
function backspace(view: EditorView) {
  const binding = closeBracketsKeymap.find((item) => item.key === "Backspace");
  return binding?.run?.(view) ?? false;
}
describe("Real music editor", () => {
  it("closes brackets and quotes as you type and steps over the closing character", () => {
    const view = editor("");
    typeText(view, 's("bd")');
    expect(view.state.doc.toString()).toBe('s("bd")');
    expect(view.state.selection.main.head).toBe(7);
    view.dispatch({ changes: { from: 0, to: 7, insert: "" } });
    typeText(view, "stack(");
    expect(view.state.doc.toString()).toBe("stack()");
    expect(view.state.selection.main.head).toBe(6);
    typeText(view, "[");
    expect(view.state.doc.toString()).toBe("stack([])");
  });
  it("removes both characters of an empty pair with backspace", () => {
    const view = editor("");
    typeText(view, "(");
    expect(view.state.doc.toString()).toBe("()");
    expect(backspace(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("");
  });
  it("wraps a selection in the typed bracket", () => {
    const view = editor("bd sd");
    view.dispatch({ selection: { anchor: 0, head: 2 } });
    typeText(view, "[");
    expect(view.state.doc.toString()).toBe("[bd] sd");
  });
  it("does not pair apostrophes inside words", () => {
    const view = editor("don");
    view.dispatch({ selection: { anchor: 3 } });
    typeText(view, "'");
    expect(view.state.doc.toString()).toBe("don'");
  });
  it("lets users type arbitrary code and re-derives the controls", () => {
    const change = vi.fn();
    const view = editor(SAMPLE_CODE, change);
    const source = 'claps: s("cp ~").gain(0.3);';
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
    expect(change).toHaveBeenLastCalledWith(source, expect.objectContaining({ valid: true }));
    expect(view.state.field(musicModel).tracks[0]!.name).toBe("claps");
    expect(view.contentDOM.getAttribute("contenteditable")).toBe("true");
  });
  it("uses one source and undo history for typing, toggles and parameter changes", () => {
    const view = editor();
    dispatchLensEdit(view, { target: "drums/rhythm", step: 1 });
    const afterToggle = view.state.doc.toString();
    expect(afterToggle).toContain('s("bd bd sd ~ bd bd sd ~")');
    dispatchLensEdit(view, { target: "bass/param/lpf", value: 430 });
    expect(view.state.doc.toString()).toContain(".lpf(430)");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(afterToggle);
    undo(view);
    expect(view.state.doc.toString()).toBe(SAMPLE_CODE);
    redo(view);
    expect(view.state.doc.toString()).toBe(afterToggle);
  });
  it("groups a whole knob gesture as one undo step, separate from earlier edits", () => {
    const view = editor();
    dispatchLensEdit(view, { target: "hats/param/gain", value: 0.7 });
    const beforeDrag = view.state.doc.toString();
    view.dispatch({ annotations: isolateHistory.of("after") });
    const time = Date.now();
    for (const value of [1100, 800, 430])
      dispatchLensEdit(view, { target: "bass/param/lpf", value }, time);
    // Drag moves are applied once per frame; the control flushes them before ending a gesture.
    flushLensEdits(view);
    view.dispatch({ annotations: isolateHistory.of("after") });
    undo(view);
    expect(view.state.doc.toString()).toBe(beforeDrag);
    undo(view);
    expect(view.state.doc.toString()).toBe(SAMPLE_CODE);
  });
  it("applies several drag moves in one frame as a single edit with the latest value", () => {
    const view = editor();
    const dispatch = vi.spyOn(view, "dispatch");
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const time = Date.now();
    for (const value of [1100, 800, 430])
      dispatchLensEdit(view, { target: "bass/param/lpf", value }, time);
    expect(dispatch).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe(SAMPLE_CODE);
    frames[0]!(0);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(view.state.doc.toString()).toContain("430");
    vi.unstubAllGlobals();
  });
  it("updates a focused knob in place when its source changes", () => {
    const view = editor();
    const slider = view.dom.querySelector<HTMLElement>('[aria-label="bass lpf"]')!;
    slider.focus();
    act(() => {
      dispatchLensEdit(view, { target: "bass/param/lpf", value: 800 });
    });
    expect(view.dom.querySelector('[aria-label="bass lpf"]')).toBe(slider);
    expect(slider.getAttribute("aria-valuenow")).toBe("800");
    expect(document.activeElement).toBe(slider);
  });
  it("renders inline controls for direct tracks in a multiline stack", () => {
    const source =
      'setcps(0.5)\nstack(\n  s("bd ~ bd [~ bd]")\n    .gain(0.8),\n  s("~ hh ~ hh")\n    .room(0.2)\n)';
    const view = editor(source);
    expect(view.dom.querySelectorAll('[aria-label^="Track 1, step"]')).toHaveLength(4);
    expect(view.dom.querySelector('[aria-label*="subdivided: rest, bd"]')).not.toBeNull();
    expect(view.dom.querySelector('[aria-label="Track 1 gain"]')).not.toBeNull();
    const substep = view.dom.querySelector<HTMLButtonElement>(
      '[aria-label="Track 1, part 1 of step 4, rest"]',
    );
    expect(substep).not.toBeNull();
    substep!.click();
    expect(view.state.doc.toString()).toContain("[bd bd]");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(source);
    expect(view.dom.querySelectorAll('[aria-label^="Track 2, step"]')).toHaveLength(4);
    expect(view.dom.querySelector('[aria-label="Track 2 room"]')).not.toBeNull();
    expect(dispatchLensEdit(view, { target: "Track 2/param/room", value: 0.4 })).toBe(true);
    expect(view.state.doc.toString()).toContain(".room(0.4)");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(source);
  });
  it("keeps alternation branches separately keyboard-accessible and undoable", () => {
    const source = 'drums: s("bd <~ sd> cp");';
    const view = editor(source);
    const branch = view.dom.querySelector<HTMLButtonElement>(
      '[aria-label="drums, alternative 1 of step 2, rest"]',
    );
    expect(branch).not.toBeNull();
    branch!.focus();
    branch!.click();
    expect(view.state.doc.toString()).toBe('drums: s("bd <bd sd> cp");');
    expect(document.activeElement).toBe(branch);
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(source);
  });
  it("puts a stack track rename in the same undo history as the editor", () => {
    const source = 'stack(\n  s("bd"),\n  s("hh")\n)';
    const view = editor(source);
    const patch = renameTrackPatch(source, "Track 1", "Drums");
    expect(patch).not.toBeNull();
    view.dispatch({
      changes: patch!,
      annotations: [Transaction.userEvent.of("input.type.track-rename"), isolateHistory.of("full")],
    });
    expect(view.state.field(musicModel).tracks[0]?.name).toBe("Drums");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(source);
  });
});
