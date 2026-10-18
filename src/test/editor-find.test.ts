import { afterEach, describe, expect, it, vi } from "vitest";
import { getSearchQuery } from "@codemirror/search";
import { createMusicEditor } from "@/components/jam/code-editor";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("editor find", () => {
  it("opens Find with Ctrl+F and searches the active music source", async () => {
    const mount = document.createElement("div");
    document.body.append(mount);
    const view = createMusicEditor(mount, 'drums: s("bd");\nhats: s("hh");', vi.fn(), vi.fn());
    view.focus();
    view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "f",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    const find = mount.querySelector<HTMLInputElement>('input[aria-label="Find"]');
    expect(find).not.toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(find));
    find!.value = "hats";
    find!.dispatchEvent(new KeyboardEvent("keyup", { key: "s", bubbles: true }));
    expect(getSearchQuery(view.state).search).toBe("hats");
    view.destroy();
  });
});
