import { Annotation, EditorState, StateEffect, StateField, Transaction } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  isolateHistory,
  redo,
  undo,
} from "@codemirror/commands";
import { HighlightStyle, bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { ySyncFacet, yUndoManagerKeymap } from "y-codemirror.next";
import { tags } from "@lezer/highlight";
import {
  deriveMusic,
  lensPatch,
  type LensEdit,
  type MusicDocument,
  type MusicTrack,
} from "@/engine/music-document";
import { createTrackControls, trackShape, updateTrackControls } from "./live-lenses";
import { destroyInlineParameters } from "./inline-parameter";
import { playbackHighlightExtension } from "./playback-highlights";

export const musicModel = StateField.define<MusicDocument>({
  create: (state) => deriveMusic(state.doc.toString()),
  update: (value, tr) => (tr.docChanged ? deriveMusic(tr.newDoc.toString()) : value),
});
const linkedEffect = StateEffect.define<string | null>();
const linkedLens = StateField.define<string | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(linkedEffect)) value = effect.value;
    return value;
  },
});
const controlGesture = Annotation.define<boolean>();

export function dispatchLensEdit(view: EditorView, edit: LensEdit, gestureTime?: number) {
  if (!view.state.facet(EditorView.editable)) return false;
  const patch = lensPatch(view.state.doc.toString(), edit);
  if (!patch) return false;
  view.dispatch({
    changes: patch,
    annotations:
      gestureTime === undefined
        ? [Transaction.userEvent.of("input.type.lens"), isolateHistory.of("full")]
        : [
            Transaction.userEvent.of("input.type.lens"),
            Transaction.time.of(gestureTime),
            controlGesture.of(true),
          ],
  });
  return true;
}
export function dispatchMusicHistory(view: EditorView, forward: boolean) {
  if (!view.state.facet(EditorView.editable)) return false;
  if (view.state.facet(ySyncFacet))
    return yUndoManagerKeymap[forward ? 1 : 0]?.run?.(view) ?? false;
  return (forward ? redo : undo)(view);
}
export function openMusicFind(view: EditorView) {
  openSearchPanel(view);
  const field = view.dom.querySelector<HTMLInputElement>(".cm-panel.cm-search [main-field]");
  field?.focus();
  field?.select();
  return true;
}
function link(view: EditorView, id: string | null) {
  if (view.state.field(linkedLens) !== id) view.dispatch({ effects: linkedEffect.of(id) });
  view.dom
    .querySelectorAll<HTMLElement>("[data-live-lens]")
    .forEach((element) =>
      element.classList.toggle("is-linked", element.dataset["liveLens"] === id),
    );
}
class TrackWidget extends WidgetType {
  constructor(readonly track: MusicTrack) {
    super();
  }
  override eq(other: TrackWidget) {
    return JSON.stringify(this.track) === JSON.stringify(other.track);
  }
  toDOM(view: EditorView) {
    return createTrackControls(this.track, {
      canEdit: () => view.state.facet(EditorView.editable),
      model: () => view.state.field(musicModel),
      edit: (edit, gesture) => {
        dispatchLensEdit(view, edit, gesture);
      },
      link: (id) => link(view, id),
      finishGesture: () => view.dispatch({ annotations: isolateHistory.of("after") }),
      history: (forward) => {
        dispatchMusicHistory(view, forward);
      },
    });
  }
  override updateDOM(dom: HTMLElement) {
    if (dom.dataset["shape"] !== trackShape(this.track)) return false;
    updateTrackControls(dom, this.track);
    return true;
  }
  override destroy(dom: HTMLElement) {
    destroyInlineParameters(dom);
  }
  override ignoreEvent() {
    return true;
  }
}
function widgetDecorations(state: EditorState) {
  return Decoration.set(
    state
      .field(musicModel)
      .tracks.map((track) =>
        Decoration.widget({ widget: new TrackWidget(track), block: true, side: 1 }).range(
          state.doc.lineAt(track.to).to,
        ),
      ),
    true,
  );
}
const widgets = StateField.define<DecorationSet>({
  create: widgetDecorations,
  update: (value, tr) => (tr.docChanged ? widgetDecorations(tr.state) : value),
  provide: (field) => EditorView.decorations.from(field),
});
function linkedDecoration(state: EditorState) {
  const id = state.field(linkedLens);
  const lens = state
    .field(musicModel)
    .tracks.flatMap((track) => track.lenses)
    .find((item) => item.id === id);
  return lens
    ? Decoration.set([Decoration.mark({ class: "cm-linked-source" }).range(lens.from, lens.to)])
    : Decoration.none;
}
const relationship = StateField.define<DecorationSet>({
  create: linkedDecoration,
  update: (value, tr) =>
    tr.docChanged || tr.effects.some((effect) => effect.is(linkedEffect))
      ? linkedDecoration(tr.state)
      : value,
  provide: (field) => EditorView.decorations.from(field),
});
const highlighting = HighlightStyle.define([
  { tag: [tags.function(tags.variableName), tags.propertyName], color: "var(--syn-function)" },
  { tag: tags.number, color: "var(--syn-number)" },
  { tag: tags.string, color: "var(--syn-pattern)" },
  { tag: tags.keyword, color: "var(--syn-keyword)" },
  { tag: tags.comment, color: "var(--syn-comment)" },
  { tag: tags.labelName, color: "var(--foreground)", fontWeight: "500" },
]);
export function createMusicEditor(
  parent: HTMLElement,
  code: string,
  onChange: (code: string, model: MusicDocument, control?: boolean) => void,
  onEvaluate: () => void,
) {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: code,
      extensions: [
        musicModel,
        linkedLens,
        widgets,
        relationship,
        playbackHighlightExtension,
        history({ joinToEvent: (tr, adjacent) => !!tr.annotation(controlGesture) || adjacent }),
        lineNumbers(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        javascript(),
        search({ top: true }),
        syntaxHighlighting(highlighting),
        keymap.of([
          {
            key: "Mod-Enter",
            run() {
              onEvaluate();
              return true;
            },
          },
          { key: "Mod-f", run: openMusicFind },
          ...searchKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.contentAttributes.of({
          "aria-label": "Music code",
          role: "textbox",
          "aria-multiline": "true",
          spellcheck: "false",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const control = update.transactions.some(
              (transaction) =>
                transaction.isUserEvent("input.type.lens") ||
                transaction.isUserEvent("input.tempo"),
            );
            if (control) {
              onChange(update.state.doc.toString(), update.state.field(musicModel), true);
            } else onChange(update.state.doc.toString(), update.state.field(musicModel));
          }
        }),
        EditorView.domEventHandlers({
          mousemove(event, view) {
            if ((event.target as HTMLElement).closest(".jam-live-strip")) return false;
            const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
            const lens =
              position === null
                ? null
                : view.state
                    .field(musicModel)
                    .tracks.flatMap((track) => track.lenses)
                    .find((item) => position >= item.from && position < item.to);
            link(view, lens?.id ?? null);
            return false;
          },
          mouseleave(_event, view) {
            if (
              !view.dom.querySelector(".is-dragging") &&
              !view.dom.querySelector(".jam-live-strip :focus")
            )
              link(view, null);
          },
        }),
        EditorView.theme(
          {
            "&": {
              height: "100%",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            },
            ".cm-scroller": {
              fontFamily: "var(--font-mono)",
              fontSize: "14px",
              lineHeight: "26px",
              overflow: "auto",
            },
            ".cm-content": { padding: "16px 0 32px", caretColor: "var(--primary)" },
            ".cm-line": { padding: "0 16px 0 8px" },
            ".cm-gutters": {
              backgroundColor: "var(--background)",
              color: "var(--muted-foreground)",
              border: "none",
            },
            ".cm-lineNumbers .cm-gutterElement": {
              padding: "0 12px 0 16px",
              minWidth: "40px",
              fontSize: "11px",
              opacity: "0.65",
            },
            ".cm-activeLine": { backgroundColor: "transparent" },
            "&.cm-focused .cm-activeLine": { backgroundColor: "var(--card)" },
            ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
            ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
              backgroundColor: "var(--selection)",
            },
            "&.cm-focused": { outline: "none" },
            ".cm-content:focus-visible": { outline: "none" },
            ".cm-panels": {
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              borderColor: "var(--border)",
            },
            ".cm-panel.cm-search": { padding: "8px 32px 8px 12px" },
            ".cm-search .cm-textfield": {
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "4px 7px",
            },
            ".cm-search .cm-button": {
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "4px 7px",
            },
          },
          { dark: true },
        ),
      ],
    }),
  });
}
