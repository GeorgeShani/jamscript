import {
  PARAMS,
  type LensEdit,
  type MusicDocument,
  type MusicTrack,
  type ParamLens,
} from "@/engine/music-document";

export interface LensHost {
  model(): MusicDocument;
  edit(edit: LensEdit, gesture?: number): void;
  link(id: string | null): void;
  finishGesture(): void;
  history(redo: boolean): void;
}
export const trackShape = (track: MusicTrack) =>
  track.lenses
    .map((lens) =>
      lens.kind === "param" ? lens.id : `${lens.id}:${lens.locked}:${lens.steps.length}`,
    )
    .join("|");
function currentParam(host: LensHost, id: string) {
  const lens = host
    .model()
    .tracks.flatMap((track) => track.lenses)
    .find((item) => item.id === id);
  return lens?.kind === "param" ? lens : null;
}
const format = (lens: ParamLens) =>
  lens.name === "lpf" || lens.name === "hpf"
    ? `${Math.round(lens.value)} Hz`
    : lens.value.toFixed(2);

function parameterControl(lens: ParamLens, host: LensHost) {
  const group = document.createElement("div");
  group.className = "jam-live-param";
  const knob = document.createElement("div");
  knob.className = "jam-knob";
  knob.tabIndex = 0;
  knob.setAttribute("role", "slider");
  knob.setAttribute("aria-label", `${lens.track} ${lens.name}`);
  knob.title =
    "Drag up or down. Arrow keys adjust; Shift adjusts faster. Double-click to type a value.";
  const indicator = document.createElement("span");
  indicator.className = "jam-knob-indicator";
  indicator.setAttribute("aria-hidden", "true");
  knob.append(indicator);
  const label = document.createElement("span");
  label.className = "jam-param-name";
  label.textContent = lens.name;
  const value = document.createElement("button");
  value.type = "button";
  value.className = "jam-param-value code-face";
  value.setAttribute("aria-label", `Set ${lens.track} ${lens.name} value`);
  value.title = "Click to type a value";
  group.append(knob, label, value);
  knob.onkeydown = (event) => {
    const param = currentParam(host, lens.id);
    if (!param || event.ctrlKey || event.metaKey) return;
    const spec = PARAMS[param.name];
    const direction = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? spec.min
        : event.key === "End"
          ? spec.max
          : param.value + direction! * spec.step * (event.shiftKey ? 10 : 1);
    host.edit({ target: lens.id, value: Math.min(spec.max, Math.max(spec.min, next)) });
  };
  let drag: { y: number; position: number; time: number; pointerId: number } | null = null;
  knob.onpointerdown = (event) => {
    if (event.button !== 0) return;
    const param = currentParam(host, lens.id);
    if (!param) return;
    event.preventDefault();
    knob.focus({ preventScroll: true });
    const spec = PARAMS[param.name];
    drag = {
      y: event.clientY,
      position: spec.log
        ? Math.log(param.value / spec.min) / Math.log(spec.max / spec.min)
        : (param.value - spec.min) / (spec.max - spec.min),
      time: Date.now(),
      pointerId: event.pointerId,
    };
    host.finishGesture();
    knob.setPointerCapture(event.pointerId);
    knob.classList.add("is-dragging");
  };
  knob.onpointermove = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const param = currentParam(host, lens.id);
    if (!param) return;
    const spec = PARAMS[param.name];
    const position = Math.min(
      1,
      Math.max(0, drag.position + (drag.y - event.clientY) / (event.shiftKey ? 1200 : 240)),
    );
    const next = spec.log
      ? spec.min * Math.pow(spec.max / spec.min, position)
      : spec.min + position * (spec.max - spec.min);
    host.edit(
      {
        target: lens.id,
        value: Math.min(spec.max, Math.max(spec.min, Math.round(next / spec.step) * spec.step)),
      },
      drag.time,
    );
  };
  const finish = () => {
    if (!drag) return;
    drag = null;
    knob.classList.remove("is-dragging");
    host.finishGesture();
  };
  knob.onpointerup = finish;
  knob.onpointercancel = finish;
  knob.onlostpointercapture = finish;
  const typeValue = () => {
    if (group.querySelector("input")) return;
    const param = currentParam(host, lens.id);
    if (!param) return;
    const spec = PARAMS[param.name];
    const input = document.createElement("input");
    input.type = "number";
    input.className = "jam-param-input code-face";
    input.setAttribute("aria-label", `${lens.track} ${lens.name} value`);
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(param.value);
    value.hidden = true;
    group.append(input);
    let done = false;
    const close = (commit: boolean) => {
      if (done) return;
      done = true;
      if (commit && input.value.trim() && Number.isFinite(input.valueAsNumber))
        host.edit({
          target: lens.id,
          value: Math.min(spec.max, Math.max(spec.min, input.valueAsNumber)),
        });
      input.remove();
      value.hidden = false;
      knob.focus({ preventScroll: true });
    };
    input.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(event.key === "Enter");
      }
    };
    input.onblur = () => close(true);
    input.focus({ preventScroll: true });
    input.select();
  };
  value.onclick = typeValue;
  knob.ondblclick = typeValue;
  return group;
}

/** CodeMirror widgets own DOM and focus, never a second copy of the music. */
export function createTrackControls(track: MusicTrack, host: LensHost) {
  const strip = document.createElement("div");
  strip.className = "jam-live-strip";
  strip.dataset["shape"] = trackShape(track);
  strip.setAttribute("role", "group");
  strip.setAttribute("aria-label", `${track.name} lenses`);
  strip.style.borderLeftColor = `var(--track-${track.color})`;
  strip.onkeydown = (event) => {
    if (!(event.ctrlKey || event.metaKey) || !["z", "y"].includes(event.key.toLowerCase())) return;
    event.preventDefault();
    host.history(event.shiftKey || event.key.toLowerCase() === "y");
  };
  for (const lens of track.lenses) {
    const shell = document.createElement("div");
    shell.className = "jam-live-lens";
    shell.dataset["liveLens"] = lens.id;
    shell.onpointerenter = () => host.link(lens.id);
    shell.onpointerleave = () => {
      if (!shell.contains(document.activeElement)) host.link(null);
    };
    shell.addEventListener("focusin", () => host.link(lens.id));
    shell.addEventListener("focusout", (event) => {
      if (!shell.contains(event.relatedTarget as Node)) host.link(null);
    });
    if (lens.kind === "param") shell.append(parameterControl(lens, host));
    else if (lens.locked) {
      shell.classList.add("jam-locked-lens");
      shell.tabIndex = 0;
      shell.setAttribute("aria-disabled", "true");
      shell.setAttribute("aria-label", `${track.name} pattern, locked`);
      shell.title =
        "This pattern is outside the safe grid subset. You can edit it directly in code.";
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("fill", "none");
      icon.setAttribute("stroke", "currentColor");
      icon.setAttribute("stroke-width", "1.5");
      icon.setAttribute("aria-hidden", "true");
      for (const d of ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"]) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        icon.append(path);
      }
      shell.append(icon, document.createTextNode("Edit this pattern in code"));
    } else {
      shell.classList.add("jam-live-rhythm");
      lens.steps.forEach((_step, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "jam-rhythm-cell";
        button.dataset["step"] = String(index);
        button.onclick = () => host.edit({ target: lens.id, step: index });
        shell.append(button);
      });
    }
    strip.append(shell);
  }
  updateTrackControls(strip, track);
  return strip;
}

/** Keep DOM nodes in place so dragging and keyboard focus survive source edits. */
export function updateTrackControls(strip: HTMLElement, track: MusicTrack) {
  for (const lens of track.lenses) {
    const shell = [...strip.children].find(
      (node) => (node as HTMLElement).dataset["liveLens"] === lens.id,
    ) as HTMLElement | undefined;
    if (!shell) continue;
    if (lens.kind === "param") {
      const knob = shell.querySelector<HTMLElement>("[role=slider]")!;
      const spec = PARAMS[lens.name];
      knob.setAttribute("aria-valuemin", String(spec.min));
      knob.setAttribute("aria-valuemax", String(spec.max));
      knob.setAttribute("aria-valuenow", String(lens.value));
      knob.setAttribute("aria-valuetext", format(lens));
      shell.querySelector(".jam-param-value")!.textContent = format(lens);
      const position = spec.log
        ? Math.log(lens.value / spec.min) / Math.log(spec.max / spec.min)
        : (lens.value - spec.min) / (spec.max - spec.min);
      shell.querySelector<HTMLElement>(".jam-knob-indicator")!.style.transform =
        `translateX(-50%) rotate(${-135 + position * 270}deg)`;
    } else if (!lens.locked) {
      shell.querySelectorAll<HTMLButtonElement>("button").forEach((button, index) => {
        const step = lens.steps[index];
        if (!step) return;
        const sound = step.sound;
        button.setAttribute("aria-pressed", String(sound !== null));
        button.setAttribute("aria-label", `${track.name}, step ${index + 1}, ${sound ?? "rest"}`);
        button.title = sound
          ? `Step ${index + 1}: ${sound}. Click to silence.`
          : `Step ${index + 1}: rest. Click to add ${lens.defaultSound}.`;
      });
    }
  }
}
