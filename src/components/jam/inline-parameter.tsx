import { createRoot, type Root } from "react-dom/client";
import type { ParamLens } from "@/engine/music-document";
import type { LensHost } from "./live-lenses";
import { InlineParameter } from "./inline-parameter-control";

const roots = new WeakMap<HTMLElement, { root: Root; host: LensHost }>();
export function mountInlineParameter(lens: ParamLens, host: LensHost) {
  const node = document.createElement("div");
  node.dataset["audioParam"] = "";
  const root = createRoot(node);
  roots.set(node, { root, host });
  root.render(<InlineParameter lens={lens} host={host} />);
  return node;
}
export function updateInlineParameter(node: HTMLElement, lens: ParamLens) {
  const state = roots.get(node);
  state?.root.render(<InlineParameter lens={lens} host={state.host} />);
}
export function destroyInlineParameters(strip: HTMLElement) {
  strip.querySelectorAll<HTMLElement>("[data-audio-param]").forEach((node) => {
    const state = roots.get(node);
    roots.delete(node);
    if (state) queueMicrotask(() => state.root.unmount());
  });
}
