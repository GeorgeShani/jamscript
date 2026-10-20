import { describe, expect, it } from "vitest";
import { StrudelLanguageService } from "@/features/language/strudel-lsp-core";

const request = (id: number, method: string, params: object) => ({
  jsonrpc: "2.0" as const,
  id,
  method,
  params,
});

describe("Strudel language service", () => {
  function analyze(source: string, method: string, character = source.length, extra = {}) {
    const service = new StrudelLanguageService();
    const uri = "file:///features.js";
    service.handle({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: { uri, version: 1, text: source },
      },
    });
    const before = source.slice(0, character);
    const result = service.handle(
      request(99, method, {
        textDocument: { uri },
        position: {
          line: before.split("\n").length - 1,
          character: character - before.lastIndexOf("\n") - 1,
        },
        ...extra,
      }),
    );
    service.handle({ jsonrpc: "2.0", method: "exit" });
    return result;
  }

  it("infers object members and standard JavaScript types instead of suggesting Strudel everywhere", () => {
    const object = analyze(
      "const synth = { cutoff: 1200, volume: 0.4 };\nsynth.cu",
      "textDocument/completion",
    );
    expect(JSON.stringify(object)).toContain('"label":"cutoff"');
    const standard = analyze("Math.ma", "textDocument/completion");
    expect(JSON.stringify(standard)).toContain('"label":"max"');
    expect(JSON.stringify(standard)).not.toContain('"label":"mask"');
    expect(
      JSON.stringify(analyze('const pitches = ["c3"]; pitches.', "textDocument/completion")),
    ).toContain('"label":"map"');
  });

  it("shows inferred local types and counts the active argument through nested calls", () => {
    expect(JSON.stringify(analyze("const tempo = 0.5; tempo", "textDocument/hover"))).toContain(
      "0.5",
    );
    const source = "function mix(level, pan) { return level + pan }\nmix(Math.max(0, 1), ";
    expect(analyze(source, "textDocument/signatureHelp")[0]).toMatchObject({
      result: {
        activeParameter: 1,
        signatures: [{ parameters: [{ label: "level" }, { label: "pan" }] }],
      },
    });
  });

  it("navigates and renames local references without changing strings or comments", () => {
    const source = 'const tempo = 0.5;\nsetcps(tempo); // tempo\n"tempo"';
    const cursor = source.indexOf("tempo)") + 2;
    expect(analyze(source, "textDocument/definition", cursor)[0]).toMatchObject({
      result: [{ uri: "file:///features.js", range: { start: { line: 0, character: 6 } } }],
    });
    const rename = analyze(source, "textDocument/rename", cursor, { newName: "speed" })[0] as {
      result: { changes: Record<string, { newText: string }[]> };
    };
    expect(rename.result.changes["file:///features.js"]).toHaveLength(2);
    expect(
      rename.result.changes["file:///features.js"]?.every((edit) => edit.newText === "speed"),
    ).toBe(true);
  });

  it("suppresses completions in comments and non-sound strings", () => {
    expect(analyze('// s("bd gai', "textDocument/completion")[0]).toMatchObject({
      result: { items: [] },
    });
    expect(analyze("// gai", "textDocument/completion")[0]).toMatchObject({
      result: { items: [] },
    });
    expect(analyze('const title = "gai', "textDocument/completion")[0]).toMatchObject({
      result: { items: [] },
    });
  });

  it("keeps local shadowing, lexical scope and Strudel mini-notation accurate", () => {
    expect(JSON.stringify(analyze("const gain = 3; gain", "textDocument/hover"))).toContain(
      "const gain: 3",
    );
    expect(
      JSON.stringify(analyze("function melody(pitch) { pit", "textDocument/completion")),
    ).toContain('"label":"pitch"');
    expect(JSON.stringify(analyze('"0 1".ear', "textDocument/completion"))).toContain(
      '"label":"early"',
    );
    expect(JSON.stringify(analyze('s("bd").phaser', "textDocument/hover"))).toContain("phaser");
    expect(
      analyze("const speed = 1; speed", "textDocument/rename", undefined, { newName: "return" })[0],
    ).toMatchObject({ result: null });
  });

  it("re-requests truncated completion lists and never renames built-in Strudel declarations", () => {
    expect(analyze("", "textDocument/completion")[0]).toMatchObject({
      result: { isIncomplete: true },
    });
    expect(analyze("gain", "textDocument/prepareRename")[0]).toMatchObject({ result: null });
    const references = analyze("const tempo = 0.5; setcps(tempo)", "textDocument/references", 26, {
      context: { includeDeclaration: false },
    })[0] as { result: unknown[] };
    expect(references.result).toHaveLength(1);
  });

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
    expect(JSON.stringify(signature)).toContain("s(sound: PatternInput<string>");
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
    expect(JSON.stringify(signature)).toContain("samples(source: string | SampleMap");
  });

  it("completes pinned GM sounds inside a mini-notation string without evaluating it", () => {
    const service = new StrudelLanguageService();
    const uri = "file:///sounds.js";
    service.handle({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: { textDocument: { uri, version: 1, text: 's("bd gm_ep")' } },
    });
    const completions = service.handle(
      request(12, "textDocument/completion", {
        textDocument: { uri, version: 1 },
        position: { line: 0, character: 11 },
      }),
    );
    expect(JSON.stringify(completions)).toContain('"label":"gm_epiano1"');
    const hover = service.handle(
      request(13, "textDocument/hover", {
        textDocument: { uri, version: 1 },
        position: { line: 0, character: 4 },
      }),
    );
    expect(hover).toEqual([{ jsonrpc: "2.0", id: 13, result: null }]);
  });
});
