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

  it("finds local declarations and nested call signatures without treating comments as symbols", () => {
    const service = new StrudelLanguageService();
    const uri = "file:///nested.js";
    service.handle({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri,
          version: 3,
          text: '// const ghost = 1\nconst chords = chord("Bbm9")\nstack(s("bd"), chords)',
        },
      },
    });
    const completions = service.handle(
      request(4, "textDocument/completion", {
        textDocument: { uri, version: 3 },
        position: { line: 2, character: 22 },
      }),
    );
    expect(JSON.stringify(completions)).toContain('"label":"chords"');
    expect(JSON.stringify(completions)).not.toContain('"label":"ghost"');
    const signature = service.handle(
      request(5, "textDocument/signatureHelp", {
        textDocument: { uri },
        position: { line: 2, character: 11 },
      }),
    );
    expect(JSON.stringify(signature)).toContain("s(sound)");
    expect(
      service.handle(
        request(6, "textDocument/completion", {
          textDocument: { uri, version: 2 },
          position: { line: 2, character: 22 },
        }),
      ),
    ).toEqual([{ jsonrpc: "2.0", id: 6, result: null }]);
  });

  it("explains coastline chord and sample calls from the offline service", () => {
    const service = new StrudelLanguageService();
    const uri = "file:///coastline.js";
    service.handle({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri,
          version: 1,
          text: "samples('github:eddyflux/crate')\nlet chords = chord('<Bbm9 Fm9>/4')",
        },
      },
    });
    const hover = service.handle(
      request(7, "textDocument/hover", {
        textDocument: { uri, version: 1 },
        position: { line: 1, character: 16 },
      }),
    );
    expect(JSON.stringify(hover)).toContain("Create a pattern of chord symbols");
    const signature = service.handle(
      request(8, "textDocument/signatureHelp", {
        textDocument: { uri, version: 1 },
        position: { line: 0, character: 13 },
      }),
    );
    expect(JSON.stringify(signature)).toContain("samples(source)");
  });
});
