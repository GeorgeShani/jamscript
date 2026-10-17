import { describe, expect, it } from "vitest";
import { StrudelLanguageService } from "@/features/language/strudel-lsp-core";

const request = (id: number, method: string, params: object) => ({
  jsonrpc: "2.0" as const,
  id,
  method,
  params,
});

describe("Strudel language service", () => {
  it("provides offline completions and signatures from the pinned API without evaluating source", () => {
    const service = new StrudelLanguageService();
    const uri = "file:///coastline.js";
    const init = service.handle(request(1, "initialize", {}));
    expect(init[0]).toMatchObject({ result: { capabilities: { hoverProvider: true } } });
    service.handle({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri,
          version: 1,
          text: "const drums = stack(s('bd'), s('sd'))\nsetcps(0.75)",
        },
      },
    });
    const completions = service.handle(
      request(2, "textDocument/completion", {
        textDocument: { uri },
        position: { line: 0, character: 24 },
      }),
    );
    expect(JSON.stringify(completions)).toContain('"label":"bd"');
    const hover = service.handle(
      request(3, "textDocument/hover", {
        textDocument: { uri },
        position: { line: 1, character: 4 },
      }),
    );
    expect(JSON.stringify(hover)).toContain("cycles per second");
  });

  it("ignores stale document versions and publishes current diagnostics", () => {
    const service = new StrudelLanguageService();
    const uri = "file:///song.js";
    service.handle({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: { uri, version: 1, text: "stack(" },
      },
    });
    const updated = service.handle({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: { uri, version: 2 },
        contentChanges: [{ text: "stack(s('bd'))" }],
      },
    });
    expect(updated[0]).toMatchObject({ params: { version: 2, diagnostics: [] } });
    expect(
      service.handle({
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: { uri, version: 1 },
          contentChanges: [{ text: "broken(" }],
        },
      }),
    ).toEqual([]);
  });
});
