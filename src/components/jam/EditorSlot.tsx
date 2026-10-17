import { useEffect, useRef } from "react";
import { createMusicEditor } from "./code-editor";
import { SAMPLE_CODE } from "./session";
import type { MusicDocument } from "@/engine/music-document";
import type { EditorView } from "@codemirror/view";

export function EditorSlot({
  panelOpen = false,
  initialCode = SAMPLE_CODE,
  onChange,
  onEvaluate,
  onReady,
}: {
  panelOpen?: boolean;
  initialCode?: string;
  onChange?: (code: string, model: MusicDocument) => void;
  onEvaluate?: () => void;
  onReady?: (view: EditorView | null) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onEvaluate, onReady });
  callbacks.current = { onChange, onEvaluate, onReady };
  const initial = useRef(initialCode);
  useEffect(() => {
    if (!mount.current) return;
    const view = createMusicEditor(
      mount.current,
      initial.current,
      (code, model) => callbacks.current.onChange?.(code, model),
      () => callbacks.current.onEvaluate?.(),
    );
    callbacks.current.onReady?.(view);
    return () => {
      callbacks.current.onReady?.(null);
      view.destroy();
    };
  }, []);
  return <div ref={mount} inert={panelOpen} className="jam-code-editor h-full min-h-0 min-w-0" />;
}
