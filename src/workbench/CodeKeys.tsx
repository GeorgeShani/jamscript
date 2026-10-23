import { useEffect, useState } from "react";
import { cursorCharLeft, cursorCharRight, indentMore } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { dispatchMusicHistory, typeIntoEditor } from "@/components/jam/code-editor";

/** Characters Strudel needs often that take several taps on a phone keyboard. */
const SYMBOLS = ["(", ")", '"', "[", "]", "~", "<", ">", ".", ",", ":", "*", "'", "{", "}"];

/**
 * A row of coding keys that sits on top of the phone keyboard while the editor has focus.
 * Pressing a key never takes focus from the editor, so the keyboard stays open.
 */
export function CodeKeys({
  view,
  playing,
  onPlay,
  onVisibleChange,
}: {
  view: EditorView | null;
  playing: boolean;
  onPlay: () => void;
  onVisibleChange: (visible: boolean) => void;
}) {
  const [bottom, setBottom] = useState<number | null>(null);

  useEffect(() => {
    if (!view || typeof window === "undefined") return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focused = view.hasFocus;
        // The phone keyboard shrinks the visual viewport; sit right on top of it.
        const keyboard = viewport
          ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
          : 0;
        setBottom(focused ? keyboard : null);
      });
    };
    view.dom.addEventListener("focusin", update);
    view.dom.addEventListener("focusout", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      view.dom.removeEventListener("focusin", update);
      view.dom.removeEventListener("focusout", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, [view]);

  const visible = bottom !== null;
  useEffect(() => onVisibleChange(visible), [visible, onVisibleChange]);
  if (!view || !visible) return null;

  const press = (run: () => void) => ({
    // Keep focus (and the keyboard) in the editor.
    onPointerDown: (event: React.PointerEvent) => event.preventDefault(),
    onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
    onClick: () => {
      run();
      view.focus();
    },
  });

  return (
    <div className="jam-code-keys" role="toolbar" aria-label="Coding keys" style={{ bottom }}>
      <button type="button" className="is-play" {...press(onPlay)}>
        {playing ? "Stop" : "Play"}
      </button>
      <button type="button" aria-label="Indent" {...press(() => indentMore(view))}>
        ⇥
      </button>
      <button type="button" aria-label="Move left" {...press(() => cursorCharLeft(view))}>
        ←
      </button>
      <button type="button" aria-label="Move right" {...press(() => cursorCharRight(view))}>
        →
      </button>
      {SYMBOLS.map((symbol) => (
        <button
          key={symbol}
          type="button"
          aria-label={`Type ${symbol}`}
          {...press(() => typeIntoEditor(view, symbol))}
        >
          {symbol}
        </button>
      ))}
      <button
        type="button"
        aria-label="Undo"
        {...press(() => {
          dispatchMusicHistory(view, false);
        })}
      >
        ↶
      </button>
    </div>
  );
}
