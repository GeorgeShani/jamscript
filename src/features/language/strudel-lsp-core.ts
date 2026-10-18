import api from "./strudel-api.generated.json";
import { syntaxProblems } from "./syntax-problems";
import { javascriptLanguage } from "@codemirror/lang-javascript";
import type { SyntaxNode } from "@lezer/common";

type Position = { line: number; character: number };
type Message = {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: {
    id?: number | string;
    textDocument?: { uri?: string; text?: string; version?: number };
    contentChanges?: { text?: string }[];
    position?: Position;
    query?: string;
  };
};
type Entry = { source: string; version: number };
const docs: Record<string, { signature: string; detail: string }> = {
  stack: { signature: "stack(...patterns)", detail: "Play patterns together in one cycle." },
  samples: { signature: "samples(source)", detail: "Load a named sample bank or sample manifest." },
  chord: { signature: "chord(symbols)", detail: "Create a pattern of chord symbols." },
  dict: { signature: ".dict(name)", detail: "Interpret symbols with the selected dictionary." },
  voicing: { signature: ".voicing()", detail: "Turn chord symbols into playable note voicings." },
  struct: { signature: ".struct(pattern)", detail: "Apply a rhythmic structure to a pattern." },
  bank: { signature: ".bank(name)", detail: "Select a sample bank." },
  mask: { signature: ".mask(pattern)", detail: "Silence events where the mask is off." },
  lpf: { signature: ".lpf(hertz)", detail: "Set the low-pass filter cutoff in hertz." },
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

/** A bounded, pinned documentation lookup for server-side assistant context. */
export function strudelDocumentation(name: string) {
  return docs[name] ?? null;
}
const samples = [
  "bd",
  "sd",
  "hh",
  "oh",
  "cp",
  "rim",
  "kick",
  "snare",
  "piano",
  "bass",
  ...api.sounds,
];
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

function enclosingCall(source: string, at: number) {
  const tree = javascriptLanguage.parser.parse(source);
  let node: SyntaxNode | null = tree.resolveInner(Math.max(0, at - 1), -1);
  for (; node; node = node.parent) {
    if (node.name !== "ArgList" || node.from >= at || node.to < at) continue;
    const call = node.parent;
    if (call?.name !== "CallExpression") continue;
    let name = "";
    for (let child = call.firstChild; child && child.from < node.from; child = child.nextSibling) {
      if (child.name === "VariableName" || child.name === "PropertyName")
        name = source.slice(child.from, child.to);
      if (child.name === "MemberExpression") {
        const property = child.getChild("PropertyName");
        if (property) name = source.slice(property.from, property.to);
      }
    }
    return name;
  }
  return null;
}

function isStringOrComment(source: string, at: number) {
  const node = javascriptLanguage.parser.parse(source).resolveInner(Math.max(0, at - 1), -1);
  return /^(String|LineComment|BlockComment)$/.test(node.name);
}

function inSoundArgument(source: string, at: number) {
  if (!isStringOrComment(source, at)) return false;
  return /^(s|sound)$/.test(enclosingCall(source, at) ?? "");
}

/** One analysis core for worker and stdio transports. It never executes source. */
export class StrudelLanguageService {
  private documents = new Map<string, Entry>();
  private cancelled = new Set<number | string>();

  handle(input: Message): object[] {
    const { id, method, params } = input;
    if (method === "$/cancelRequest") {
      if (params?.id !== undefined) this.cancelled.add(params.id);
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
      if (!uri) return [];
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
      const uri = params?.textDocument?.uri;
      if (uri) this.documents.delete(uri);
      return [];
    }
    if (id === undefined || this.cancelled.delete(id)) return [];
    const uri = params?.textDocument?.uri;
    const document = uri ? this.documents.get(uri) : undefined;
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
    if (
      typeof params?.textDocument?.version === "number" &&
      params.textDocument.version !== document.version
    )
      return [response(id, null)];
    const at = offset(source, params?.position ?? { line: 0, character: 0 });
    if (method === "textDocument/completion") {
      const sampleContext =
        inSoundArgument(source, at) || /\b(?:s|sound)\s*\(\s*["'][^"']*$/.test(source.slice(0, at));
      const locals = this.symbols(source).map((symbol) => symbol.name);
      const candidates = sampleContext ? samples : [...new Set([...locals, ...names])];
      const prefix = wordAt(source.slice(0, at), at).toLowerCase();
      return [
        response(id, {
          isIncomplete: false,
          items: candidates
            .filter((name) => name.toLowerCase().startsWith(prefix))
            .slice(0, 120)
            .map((name) => ({
              label: name,
              kind: sampleContext ? 12 : locals.includes(name) ? 6 : 3,
              detail: locals.includes(name)
                ? "Local declaration"
                : (docs[name]?.signature ?? `Strudel ${api.version}`),
              documentation: locals.includes(name)
                ? "Declared in this document."
                : docs[name]?.detail,
            })),
        }),
      ];
    }
    if (method === "textDocument/hover") {
      if (isStringOrComment(source, at)) return [response(id, null)];
      const name = wordAt(source, at);
      const found = docs[name];
      const local = this.symbols(source).find((symbol) => symbol.name === name);
      return [
        response(
          id,
          found || local
            ? {
                contents: {
                  kind: "markdown",
                  value: found
                    ? `**${found.signature}**\n\n${found.detail}`
                    : `**${name}** · declared on line ${local!.range.start.line + 1}`,
                },
              }
            : null,
        ),
      ];
    }
    if (method === "textDocument/signatureHelp") {
      const name = enclosingCall(source, at);
      const found = name && docs[name];
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
    const result: {
      name: string;
      kind: number;
      range: { start: Position; end: Position };
      selectionRange: { start: Position; end: Position };
    }[] = [];
    javascriptLanguage.parser.parse(source).iterate({
      enter(node) {
        if (node.name !== "VariableDefinition") return;
        const parent = node.node.parent?.name;
        if (parent !== "VariableDeclaration" && parent !== "FunctionDeclaration") return;
        const range = { start: position(source, node.from), end: position(source, node.to) };
        result.push({
          name: source.slice(node.from, node.to),
          kind: parent === "FunctionDeclaration" ? 12 : 13,
          range,
          selectionRange: range,
        });
      },
    });
    return result;
  }
}
