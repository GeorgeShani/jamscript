import { useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Knob, KnobDial, KnobTrack, KnobRange, KnobPointer } from "@/components/ui/knob";
import { PanControl, formatPan } from "@/components/ui/pan-control";
import { PARAMS, type ParamLens } from "@/engine/music-document";
import type { LensHost } from "./live-lenses";

function InlineParameter({ lens, host }: { lens: ParamLens; host: LensHost }) {
  const gesture = useRef<number | undefined>(undefined);
  const [draft, setDraft] = useState<string | null>(null);
  const spec = PARAMS[lens.name];
  const disabled = host.canEdit ? !host.canEdit() : false;
  const change = (value: number, continuous = true) => {
    if (continuous) gesture.current ??= Date.now();
    host.edit({ target: lens.id, value }, continuous ? gesture.current : undefined);
  };
  const commit = () => {
    gesture.current = undefined;
    host.finishGesture();
  };
  const text =
    lens.name === "pan"
      ? formatPan(2 * lens.value - 1)
      : lens.name === "lpf" || lens.name === "hpf"
        ? `${Math.round(lens.value)} Hz`
        : lens.name === "fast" || lens.name === "slow"
          ? `${lens.value}×`
          : lens.value.toFixed(2);
  const close = (save: boolean) => {
    if (save && draft?.trim() && Number.isFinite(Number(draft)))
      change(Math.min(spec.max, Math.max(spec.min, Number(draft))), false);
    setDraft(null);
    commit();
  };
  return (
    <div className="jam-live-param jam-audio-param">
      {lens.name === "pan" ? (
        <PanControl
          step={spec.step * 2}
          value={2 * lens.value - 1}
          size="sm"
          disabled={disabled}
          aria-label={`${lens.track} pan`}
          onValueChange={(value) => change((value + 1) / 2)}
          onValueCommitted={commit}
        />
      ) : (
        <Knob
          min={spec.min}
          max={spec.max}
          step={spec.step}
          largeStep={spec.step * 10}
          scale={spec.log ? "log" : "linear"}
          value={lens.value}
          size="sm"
          disabled={disabled}
          format={() => text}
          onValueChange={(value, details) => change(value, details.reason === "drag")}
          onValueCommitted={commit}
        >
          <KnobDial aria-label={`${lens.track} ${lens.name}`}>
            <KnobTrack />
            <KnobRange />
            <KnobPointer />
          </KnobDial>
        </Knob>
      )}
      <span className="jam-param-name">{lens.name}</span>
      {draft === null ? (
        <button
          type="button"
          disabled={disabled}
          className="jam-param-value code-face"
          aria-label={`Set ${lens.track} ${lens.name} value`}
          onClick={() => setDraft(String(lens.value))}
        >
          {text}
        </button>
      ) : (
        <input
          autoFocus
          type="number"
          className="jam-param-input"
          aria-label={`${lens.track} ${lens.name} value`}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => close(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close(event.key === "Enter");
            }
          }}
        />
      )}
    </div>
  );
}

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
