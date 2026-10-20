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
    newName?: string;
    context?: { includeDeclaration?: boolean };
  };
};
type Entry = { source: string; version: number };
import { JavaScriptIntelligence } from "./javascript-intelligence";

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
  let node: SyntaxNode | null = tree.resolveInner(at, -1);
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
  private javascript = new JavaScriptIntelligence();

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
            definitionProvider: true,
            referencesProvider: true,
            renameProvider: { prepareProvider: true },
          },
          serverInfo: { name: "JamScript JavaScript + Strudel", version: "0.2.0" },
        }),
      ];
    if (method === "initialized") return [];
    if (method === "shutdown") return [response(id!, null)];
    if (method === "exit") {
      this.documents.clear();
      this.javascript.dispose();
      return [];
    }
    if (method === "textDocument/didOpen") {
      const doc = params?.textDocument;
      if (typeof doc?.uri !== "string" || typeof doc?.text !== "string") return [];
      this.documents.set(doc.uri, { source: doc.text, version: doc.version ?? 0 });
      this.javascript.update(doc.uri, doc.text, doc.version ?? 0);
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
      this.javascript.update(uri, source, version);
      return [this.diagnostics(uri)];
    }
    if (method === "textDocument/didClose") {
      const uri = params?.textDocument?.uri;
      if (uri) {
        this.documents.delete(uri);
        this.javascript.close(uri);
        return [
          {
            jsonrpc: "2.0",
            method: "textDocument/publishDiagnostics",
            params: { uri, diagnostics: [] },
          },
        ];
      }
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
    if (method === "textDocument/definition")
      return [response(id, this.javascript.definition(uri!, at))];
    if (method === "textDocument/references")
      return [
        response(
          id,
          this.javascript.references(uri!, at, params?.context?.includeDeclaration ?? true),
        ),
      ];
    if (method === "textDocument/prepareRename")
      return [response(id, this.javascript.prepareRename(uri!, at))];
    if (method === "textDocument/rename")
      return [response(id, this.javascript.rename(uri!, at, params?.newName ?? ""))];
    if (method === "textDocument/completion") {
      const token = javascriptLanguage.parser.parse(source).resolveInner(Math.max(0, at - 1), -1);
      if (/Comment$/.test(token.name)) return [response(id, { isIncomplete: false, items: [] })];
      const sampleContext =
        inSoundArgument(source, at) || /\b(?:s|sound)\s*\(\s*["'][^"']*$/.test(source.slice(0, at));
      if (!sampleContext && isStringOrComment(source, at))
        return [response(id, { isIncomplete: false, items: [] })];
      const prefix = wordAt(source.slice(0, at), at).toLowerCase();
      if (!sampleContext) {
        const result = this.javascript.completions(uri!, at, prefix);
        return [response(id, { isIncomplete: result.incomplete, items: result.items })];
      }
      return [
        response(id, {
          isIncomplete:
            samples.filter((name) => name.toLowerCase().startsWith(prefix)).length > 120,
          items: [...new Set(samples)]
            .filter((name) => name.toLowerCase().startsWith(prefix))
            .slice(0, 120)
            .map((name) => ({
              label: name,
              kind: 12,
              detail: "Sound · Strudel",
              documentation: `Use ${name} in a sound pattern.`,
              textEdit: {
                range: { start: position(source, at - prefix.length), end: position(source, at) },
                newText: name,
              },
            })),
        }),
      ];
    }
    if (method === "textDocument/hover") {
      if (isStringOrComment(source, at)) return [response(id, null)];
      return [response(id, this.javascript.hover(uri!, at))];
    }
    if (method === "textDocument/signatureHelp") {
      return [response(id, this.javascript.signature(uri!, at))];
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
        diagnostics: [
          ...syntaxProblems(doc.source).map((problem) => ({
            range: {
              start: position(doc.source, problem.from),
              end: position(doc.source, problem.to),
            },
            severity: 1,
            source: "JamScript",
            message: problem.message,
          })),
          ...this.javascript.diagnostics(uri),
        ],
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
