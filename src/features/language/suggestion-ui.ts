import { autocompletion, type Completion } from "@codemirror/autocomplete";
import "./suggestion-ui.css";

/** Shared by browser and desktop; CodeMirror retains keyboard/ARIA behavior. */
export const suggestionUI = autocompletion({
  maxRenderedOptions: 60,
  tooltipClass: () => "jam-completions",
  icons: false,
  positionInfo(_view, list, _option, _info, space) {
    const availableRight = space.right - list.right;
    const availableLeft = list.left - space.left;
    if (Math.max(availableRight, availableLeft) >= 340) {
      return {
        style: `top:0;${availableRight >= 340 ? "left:calc(100% + 8px)" : "right:calc(100% + 8px)"};width:320px;max-height:280px`,
      };
    }
    return {
      style: "top:calc(100% + 6px);left:0;width:100%;max-height:140px",
      class: "jam-completion-info-below",
    };
  },
  addToOptions: [
    {
      position: 20,
      render(completion: Completion) {
        const icon = document.createElement("span");
        icon.className = "jam-completion-kind";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = /function|method/.test(completion.type ?? "")
          ? "ƒ"
          : completion.type === "constant"
            ? "♪"
            : "x";
        return icon;
      },
    },
  ],
});
