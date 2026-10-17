import api from "./strudel-api.generated.json";
import { syntaxProblems } from "./syntax-problems";

type Position = { line: number; character: number };
type Message = { jsonrpc: "2.0"; id?: number | string; method?: string; params?: any };
type Entry = { source: string; version: number };
const docs: Record<string, { signature: string; detail: string }> = {
  stack: { signature: "stack(...patterns)", detail: "Play patterns together in one cycle." },
  s: { signature: "s(sound)", detail: "Select a sample or instrument." },
  sound: { signature: "sound(name)", detail: "Select a sample or instrument." },
  note: { signature: "note(pitch)", detail: "Set note pitches using numbers or note names." },
  n: { signature: "n(index)", detail: "Select a sample or scale degree by index." },
  gain: { signature: ".gain(amount)", detail: "Set signal gain. Large values can clip." },
  pan: { signature: ".pan(position)", detail: "Move sound between left and right." },
  room: { signature: ".room(amount)", detail: "Add room reverb." },
  delay: { signature: ".delay(amount)", detail: "Add delay." },
  fast: { signature: ".fast(factor)", detail: "Speed up a pattern by a factor." },
  slow: { signature: ".slow(factor)", detail: "Slow down a pattern by a factor." },
  setcps: {
    signature: "setcps(cyclesPerSecond)",
    detail: "Set the global playback rate in cycles per second.",
  },
  setcpm: {
    signature: "setcpm(cyclesPerMinute)",
    detail: "Set the global playback rate in cycles per minute.",
  },
};
const samples = ["bd", "sd", "hh", "oh", "cp", "rim", "kick", "snare", "piano", "bass"];
const names = api.names.filter(
  (name) => !/^(get|setAudio|register|unregister|init|create|destroy|is[A-Z]|has[A-Z])/.test(name),
);
const offset = (source: string, pos: Position) => {
  const lines = source.split("\n");
  const line = Math.max(0, Math.min(pos.line, lines.length - 1));
  return (
    lines.slice(0, line).reduce((sum, value) => sum + value.length + 1, 0) +
    Math.max(0, Math.min(pos.character, lines[line]?.length ?? 0))
  );
};
const position = (source: string, at: number): Position => {
  const before = source.slice(0, at);
  return { line: before.split("\n").length - 1, character: at - before.lastIndexOf("\n") - 1 };
};
const wordAt = (source: string, at: number) => {
  let from = at,
    to = at;
  while (from > 0 && /[\w$]/.test(source[from - 1]!)) from--;
  while (to < source.length && /[\w$]/.test(source[to]!)) to++;
  return source.slice(from, to);
};
const response = (id: number | string, result: unknown) => ({ jsonrpc: "2.0", id, result });

/** One analysis core for worker and stdio transports. It never executes source. */
export class StrudelLanguageService {
  private documents = new Map<string, Entry>();
  private cancelled = new Set<number | string>();

  handle(input: Message): object[] {
    const { id, method, params } = input;
    if (method === "$/cancelRequest") {
      this.cancelled.add(params?.id);
      return [];
    }
    if (method === "initialize")
      return [
        response(id!, {
          capabilities: {
            textDocumentSync: 1,
            completionProvider: { triggerCharacters: [".", '"', "'"] },
            hoverProvider: true,
            signatureHelpProvider: { triggerCharacters: ["(", ","] },
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
          },
          serverInfo: { name: "JamScript Strudel", version: "0.1.0" },
        }),
      ];
    if (method === "initialized") return [];
    if (method === "shutdown") return [response(id!, null)];
    if (method === "exit") {
      this.documents.clear();
      return [];
    }
    if (method === "textDocument/didOpen") {
      const doc = params?.textDocument;
      if (typeof doc?.uri !== "string" || typeof doc?.text !== "string") return [];
      this.documents.set(doc.uri, { source: doc.text, version: doc.version ?? 0 });
      return [this.diagnostics(doc.uri)];
    }
    if (method === "textDocument/didChange") {
      const uri = params?.textDocument?.uri;
      const current = this.documents.get(uri);
      const source = params?.contentChanges?.at(-1)?.text;
      const version = params?.textDocument?.version;
      if (
        !current ||
        typeof source !== "string" ||
        typeof version !== "number" ||
        version <= current.version
      )
        return [];
      this.documents.set(uri, { source, version });
      return [this.diagnostics(uri)];
    }
    if (method === "textDocument/didClose") {
      this.documents.delete(params?.textDocument?.uri);
      return [];
    }
    if (id === undefined || this.cancelled.delete(id)) return [];
    const uri = params?.textDocument?.uri;
    const document = this.documents.get(uri);
    if (method === "workspace/symbol") {
      const query = String(params?.query ?? "").toLowerCase();
      return [
        response(
          id,
          [...this.documents].flatMap(([file, entry]) =>
            this.symbols(entry.source)
              .filter((symbol) => symbol.name.toLowerCase().includes(query))
              .map((symbol) => ({ ...symbol, location: { uri: file, range: symbol.range } })),
          ),
        ),
      ];
    }
    if (!document) return [response(id, null)];
    const source = document.source;
    const at = offset(source, params?.position ?? { line: 0, character: 0 });
    if (method === "textDocument/completion") {
      const sampleContext = /\b(?:s|sound)\s*\(\s*["'][^"']*$/.test(source.slice(0, at));
      const candidates = sampleContext ? samples : names;
      const prefix = wordAt(source.slice(0, at), at).toLowerCase();
      return [
        response(id, {
          isIncomplete: false,
          items: candidates
            .filter((name) => name.toLowerCase().startsWith(prefix))
            .slice(0, 120)
            .map((name) => ({
              label: name,
              kind: sampleContext ? 12 : 3,
              detail: docs[name]?.signature ?? `Strudel ${api.version}`,
              documentation: docs[name]?.detail,
            })),
        }),
      ];
    }
    if (method === "textDocument/hover") {
      const name = wordAt(source, at);
      const found = docs[name];
      return [
        response(
          id,
          found
            ? { contents: { kind: "markdown", value: `**${found.signature}**\n\n${found.detail}` } }
            : null,
        ),
      ];
    }
    if (method === "textDocument/signatureHelp") {
      const match = source.slice(0, at).match(/([A-Za-z_$][\w$]*)\s*\([^()]*$/);
      const found = match && docs[match[1]!];
      return [
        response(
          id,
          found
            ? {
                signatures: [{ label: found.signature, documentation: found.detail }],
                activeSignature: 0,
                activeParameter: 0,
              }
            : null,
        ),
      ];
    }
    if (method === "textDocument/documentSymbol") return [response(id, this.symbols(source))];
    return [response(id, null)];
  }

  private diagnostics(uri: string) {
    const doc = this.documents.get(uri)!;
    return {
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: {
        uri,
        version: doc.version,
        diagnostics: syntaxProblems(doc.source).map((problem) => ({
          range: {
            start: position(doc.source, problem.from),
            end: position(doc.source, problem.to),
          },
          severity: 1,
          source: "JamScript",
          message: problem.message,
        })),
      },
    };
  }

  private symbols(source: string) {
    return [...source.matchAll(/\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)].map(
      (match) => {
        const at = (match.index ?? 0) + match[0].lastIndexOf(match[1]!);
        const range = { start: position(source, at), end: position(source, at + match[1]!.length) };
        return {
          name: match[1]!,
          kind: match[0].startsWith("function") ? 12 : 13,
          range,
          selectionRange: range,
        };
      },
    );
  }
}
