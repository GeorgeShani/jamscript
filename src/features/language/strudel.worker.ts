import { StrudelLanguageService } from "./strudel-lsp-core";
const service = new StrudelLanguageService();
self.onmessage = (event: MessageEvent<string>) => {
  try {
    for (const message of service.handle(JSON.parse(event.data)))
      self.postMessage(JSON.stringify(message));
  } catch (cause) {
    self.postMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "window/logMessage",
        params: { type: 1, message: cause instanceof Error ? cause.message : String(cause) },
      }),
    );
  }
};
