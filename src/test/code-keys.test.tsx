import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";
import { createMusicEditor } from "@/components/jam/code-editor";
import { CodeKeys } from "@/workbench/CodeKeys";

let view: EditorView;
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("coarse"),
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    run(0);
    return 1;
  });
  const parent = document.createElement("div");
  document.body.append(parent);
  view = createMusicEditor(parent, "s", vi.fn(), vi.fn());
});
afterEach(() => {
  view.destroy();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function renderKeys(onPlay = vi.fn(), onVisibleChange = vi.fn()) {
  render(
    <CodeKeys view={view} playing={false} onPlay={onPlay} onVisibleChange={onVisibleChange} />,
  );
  return { onPlay, onVisibleChange };
}

describe("Phone coding keys", () => {
  it("appear only while the editor has focus on a touch screen", () => {
    const { onVisibleChange } = renderKeys();
    expect(screen.queryByRole("toolbar", { name: "Coding keys" })).toBeNull();
    act(() => {
      view.focus();
      view.dom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(screen.getByRole("toolbar", { name: "Coding keys" })).not.toBeNull();
    expect(onVisibleChange).toHaveBeenLastCalledWith(true);
  });

  it("types paired symbols at the cursor and keeps the editor focused", () => {
    renderKeys();
    act(() => {
      view.focus();
      view.dispatch({ selection: { anchor: 1 } });
      view.dom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    const key = screen.getByRole("button", { name: "Type (" });
    expect(fireEvent.pointerDown(key)).toBe(false);
    fireEvent.click(key);
    fireEvent.click(screen.getByRole("button", { name: 'Type "' }));
    expect(view.state.doc.toString()).toBe('s("")');
    expect(view.state.selection.main.head).toBe(3);
  });

  it("plays from the key row", () => {
    const { onPlay } = renderKeys();
    act(() => {
      view.focus();
      view.dom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledOnce();
  });
});
