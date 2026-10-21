import { mountInlineParameter, updateInlineParameter } from "./inline-parameter";
import {
  PARAMS,
  type LensEdit,
  type MusicDocument,
  type MusicTrack,
  type ParamLens,
} from "@/engine/music-document";

export interface LensHost {
  canEdit?: () => boolean;
  model(): MusicDocument;
  edit(edit: LensEdit, gesture?: number): void;
  link(id: string | null): void;
  finishGesture(): void;
  history(redo: boolean): void;
}
export const trackShape = (track: MusicTrack) =>
  track.lenses
    .map((lens) =>
      lens.kind === "param"
        ? lens.id
        : `${lens.id}:${lens.locked}:${lens.steps.map((step) => `${step.substeps?.length ?? 0}/${step.alternatives?.length ?? 0}`).join(",")}`,
    )
    .join("|");
/** CodeMirror widgets own DOM and focus, never a second copy of the music. */
export function createTrackControls(track: MusicTrack, host: LensHost) {
  const strip = document.createElement("div");
  strip.className = "jam-live-strip";
  strip.dataset["shape"] = trackShape(track);
  strip.setAttribute("role", "group");
  strip.setAttribute("aria-label", `${track.name} lenses`);
  strip.style.borderLeftColor = `var(--jam-track-${track.orbit}, var(--track-${track.color}))`;
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
    if (lens.kind === "param") shell.append(mountInlineParameter(lens, host));
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
      lens.steps.forEach((step, index) => {
        if (step.substeps || step.alternatives) {
          const group = document.createElement("span");
          group.className = `jam-rhythm-cell jam-rhythm-subdivision${step.alternatives ? " jam-rhythm-alternation" : ""}`;
          group.dataset["step"] = String(index);
          group.setAttribute("role", "group");
          for (const [partIndex] of (step.substeps ?? step.alternatives ?? []).entries()) {
            const button = document.createElement("button");
            button.type = "button";
            if (step.substeps) {
              button.dataset["substep"] = String(partIndex);
              button.onclick = () =>
                host.edit({ target: lens.id, step: index, substep: partIndex });
            } else {
              button.dataset["alternative"] = String(partIndex);
              button.onclick = () =>
                host.edit({ target: lens.id, step: index, alternative: partIndex });
            }
            group.append(button);
          }
          shell.append(group);
        } else {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "jam-rhythm-cell";
          button.dataset["step"] = String(index);
          button.onclick = () => host.edit({ target: lens.id, step: index });
          shell.append(button);
        }
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
      const node = shell.querySelector<HTMLElement>("[data-audio-param]");
      if (node) updateInlineParameter(node, lens);
    } else if (!lens.locked) {
      shell.querySelectorAll<HTMLElement>("[data-step]").forEach((cell) => {
        const index = Number(cell.dataset["step"]);
        const step = lens.steps[index];
        if (!step) return;
        if (step.substeps) {
          cell.setAttribute(
            "aria-label",
            `${track.name}, step ${index + 1}, subdivided: ${step.substeps.map((part) => part ?? "rest").join(", ")}`,
          );
          cell.querySelectorAll<HTMLButtonElement>("[data-substep]").forEach((part, subIndex) => {
            const sound = step.substeps?.[subIndex] ?? null;
            part.classList.toggle("is-on", sound !== null);
            part.setAttribute("aria-pressed", String(sound !== null));
            part.setAttribute(
              "aria-label",
              `${track.name}, part ${subIndex + 1} of step ${index + 1}, ${sound ?? "rest"}`,
            );
            part.title = sound ? `Click to silence ${sound}` : `Click to add ${lens.defaultSound}`;
          });
          return;
        }
        if (step.alternatives) {
          cell.setAttribute(
            "aria-label",
            `${track.name}, step ${index + 1}, alternation: ${step.alternatives.map((part) => part ?? "rest").join(", ")}`,
          );
          cell
            .querySelectorAll<HTMLButtonElement>("[data-alternative]")
            .forEach((part, alternative) => {
              const sound = step.alternatives?.[alternative] ?? null;
              part.classList.toggle("is-on", sound !== null);
              part.setAttribute("aria-pressed", String(sound !== null));
              part.setAttribute(
                "aria-label",
                `${track.name}, alternative ${alternative + 1} of step ${index + 1}, ${sound ?? "rest"}`,
              );
              part.title = sound
                ? `Click to silence ${sound}`
                : `Click to add ${lens.defaultSound}`;
            });
          return;
        }
        const sound = step.sound;
        cell.setAttribute("aria-pressed", String(sound !== null));
        cell.setAttribute("aria-label", `${track.name}, step ${index + 1}, ${sound ?? "rest"}`);
        cell.title = sound
          ? `Step ${index + 1}: ${sound}. Click to silence.`
          : `Step ${index + 1}: rest. Click to add ${lens.defaultSound}.`;
      });
    }
  }
}
