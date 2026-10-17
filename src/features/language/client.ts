import { LSPClient, languageServerExtensions, type Transport } from "@codemirror/lsp-client";
import { StateEffect } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

let client: LSPClient | null = null;

function languageClient() {
  if (client) return client;
  const worker = new Worker(new URL("./strudel.worker.ts", import.meta.url), { type: "module" });
  const subscribers = new Set<(value: string) => void>();
  worker.onmessage = (event: MessageEvent<string>) => {
    for (const subscriber of subscribers) subscriber(event.data);
  };
  const transport: Transport = {
    send(message) {
      worker.postMessage(message);
    },
    subscribe(handler) {
      subscribers.add(handler);
    },
    unsubscribe(handler) {
      subscribers.delete(handler);
    },
  };
  client = new LSPClient({ extensions: languageServerExtensions() }).connect(transport);
  return client;
}

/** Additive CodeMirror extension; source parsing and lens fields stay unchanged. */
export function attachStrudelLanguage(view: EditorView, documentId: string) {
  const extension = languageClient().plugin(
    `file:///jamscript/${encodeURIComponent(documentId)}.js`,
    "javascript",
  );
  if (view.dom.isConnected) view.dispatch({ effects: StateEffect.appendConfig.of(extension) });
}
