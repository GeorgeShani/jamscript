import ts from "typescript";
import libraries from "./typescript-libs.generated.json";
import api from "./strudel-api.generated.json";
import { docs } from "./strudel-docs";
import { strudelTypes } from "./strudel-types";

type File = { uri: string; source: string; version: number; snapshot: ts.IScriptSnapshot };
type Position = { line: number; character: number };

const globalsPath = "/lib/strudel.d.ts";
const apiNames = new Set(api.names);
const commonNames = new Set([
  "s",
  "sound",
  "note",
  "n",
  "stack",
  "gain",
  "lpf",
  "setcps",
  "setcpm",
  "samples",
  "chord",
]);
const staticFiles = new Map<string, ts.IScriptSnapshot>([
  ...Object.entries(libraries).map(
    ([name, text]) => [`/lib/${name}`, ts.ScriptSnapshot.fromString(text)] as const,
  ),
  [globalsPath, ts.ScriptSnapshot.fromString(strudelTypes)],
]);
const fileName = (uri: string) => `/documents/${encodeURIComponent(uri)}.js`;
const kind = (value: string) => {
  if (["method", "function", "local function"].includes(value)) return value === "method" ? 2 : 3;
  if (["property", "getter", "setter"].includes(value)) return 10;
  if (value === "class") return 7;
  if (value === "keyword") return 14;
  return 6;
};
const text = (parts: ts.SymbolDisplayPart[] | undefined) => ts.displayPartsToString(parts);

/** TypeScript's documented LanguageServiceHost API, with no disk/network access.
 * https://github.com/microsoft/TypeScript/wiki/Using-the-Language-Service-API
 * Runs inside the language worker (or the explicit stdio server), never the UI thread.
 */
export class JavaScriptIntelligence {
  private files = new Map<string, File>();
  private revision = 0;
  private options: ts.CompilerOptions = {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    noLib: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleDetection: ts.ModuleDetectionKind.Force,
    skipLibCheck: true,
    allowNonTsExtensions: true,
    types: [],
  };
  private service = ts.createLanguageService(
    {
      getCompilationSettings: () => this.options,
      getScriptFileNames: () => [...staticFiles.keys(), ...this.files.keys()],
      getScriptVersion: (name) => String(this.files.get(name)?.version ?? 0),
      getScriptSnapshot: (name) => this.files.get(name)?.snapshot ?? staticFiles.get(name),
      getProjectVersion: () => String(this.revision),
      getCurrentDirectory: () => "/documents",
      getDefaultLibFileName: () => "/lib/lib.es2022.d.ts",
      fileExists: (name) => this.files.has(name) || staticFiles.has(name),
      readFile: (name) => {
        const snapshot = this.files.get(name)?.snapshot ?? staticFiles.get(name);
        return snapshot?.getText(0, snapshot.getLength());
      },
      readDirectory: () => [],
    },
    ts.createDocumentRegistry(),
  );

  update(uri: string, source: string, version: number) {
    this.files.set(fileName(uri), {
      uri,
      source,
      version,
      snapshot: ts.ScriptSnapshot.fromString(source),
    });
    this.revision++;
  }
  close(uri: string) {
    this.files.delete(fileName(uri));
    this.revision++;
  }
  dispose() {
    this.files.clear();
    this.service.dispose();
  }

  private range(uri: string, span: ts.TextSpan) {
    const source = this.files.get(fileName(uri))!.source;
    const position = (offset: number): Position => {
      const before = source.slice(0, offset);
      return {
        line: before.split("\n").length - 1,
        character: offset - before.lastIndexOf("\n") - 1,
      };
    };
    return { start: position(span.start), end: position(span.start + span.length) };
  }

  completions(uri: string, at: number, prefix: string) {
    const result = this.service.getCompletionsAtPosition(fileName(uri), at, {
      includeCompletionsForModuleExports: false,
      includeCompletionsWithInsertText: true,
    });
    const entries = (result?.entries ?? []).filter((entry) =>
      entry.name.toLowerCase().startsWith(prefix.toLowerCase()),
    );
    const localNames = (items: ts.NavigationBarItem[]): string[] =>
      items.flatMap((item) => [item.text, ...localNames(item.childItems)]);
    const locals = new Set(localNames(this.service.getNavigationBarItems(fileName(uri))));
    const rank = (entry: ts.CompletionEntry) =>
      result?.isMemberCompletion || locals.has(entry.name) || commonNames.has(entry.name)
        ? "0"
        : apiNames.has(entry.name)
          ? "1"
          : "2";
    entries.sort(
      (a, b) =>
        rank(a).localeCompare(rank(b)) ||
        a.sortText.localeCompare(b.sortText) ||
        a.name.localeCompare(b.name),
    );
    return {
      incomplete: entries.length > 150,
      items: entries.slice(0, 150).map((entry) => {
        const symbol = this.service.getCompletionEntrySymbol(
          fileName(uri),
          at,
          entry.name,
          entry.source,
        );
        const strudel =
          symbol?.declarations?.some((node) => node.getSourceFile().fileName === globalsPath) ??
          false;
        const reference = strudel ? docs[entry.name] : null;
        const info = this.service.getCompletionEntryDetails(
          fileName(uri),
          at,
          entry.name,
          undefined,
          entry.source,
          {},
          entry.data,
        );
        const signature =
          text(info?.displayParts) || reference?.signature || `${entry.name}(...args: unknown[])`;
        return {
          label: entry.name,
          kind: kind(entry.kind),
          sortText: rank(entry) + entry.sortText,
          detail: strudel ? `Strudel · ${signature}` : signature || "JavaScript",
          documentation: {
            kind: "markdown",
            value:
              "```javascript\n" +
              signature +
              "\n```\n\n" +
              (reference?.detail ??
                (strudel
                  ? `Available in the pinned Strudel ${api.version} API. Types come from the installed source; unknown marks undocumented values.`
                  : text(info?.documentation))),
          },
          textEdit: {
            range: this.range(
              uri,
              entry.replacementSpan ?? { start: at - prefix.length, length: prefix.length },
            ),
            newText: entry.insertText ?? entry.name,
          },
        };
      }),
    };
  }

  isStrudelSymbol(uri: string, at: number) {
    return (
      this.service
        .getDefinitionAtPosition(fileName(uri), at)
        ?.some((item) => item.fileName === globalsPath) ?? false
    );
  }

  hover(uri: string, at: number) {
    const info = this.service.getQuickInfoAtPosition(fileName(uri), at);
    return info
      ? {
          range: this.range(uri, info.textSpan),
          contents: {
            kind: "markdown",
            value: `\`\`\`javascript\n${text(info.displayParts)}\n\`\`\`\n\n${text(info.documentation)}`,
          },
        }
      : null;
  }

  signature(uri: string, at: number) {
    const info = this.service.getSignatureHelpItems(fileName(uri), at, undefined);
    return info
      ? {
          signatures: info.items.map((item) => ({
            label:
              text(item.prefixDisplayParts) +
              item.parameters
                .map((p) => text(p.displayParts))
                .join(text(item.separatorDisplayParts)) +
              text(item.suffixDisplayParts),
            documentation: text(item.documentation),
            parameters: item.parameters.map((p) => ({
              label: p.name,
              documentation: text(p.documentation),
            })),
          })),
          activeSignature: info.selectedItemIndex,
          activeParameter: info.argumentIndex,
        }
      : null;
  }

  definition(uri: string, at: number) {
    return (this.service.getDefinitionAtPosition(fileName(uri), at) ?? []).flatMap((item) => {
      const file = this.files.get(item.fileName);
      return file ? [{ uri: file.uri, range: this.range(file.uri, item.textSpan) }] : [];
    });
  }

  references(uri: string, at: number, includeDeclaration: boolean) {
    return (this.service.findReferences(fileName(uri), at) ?? [])
      .flatMap((symbol) =>
        symbol.references.filter(
          (item) =>
            includeDeclaration ||
            !(
              item.isDefinition ||
              (item.fileName === symbol.definition.fileName &&
                item.textSpan.start === symbol.definition.textSpan.start &&
                item.textSpan.length === symbol.definition.textSpan.length)
            ),
        ),
      )
      .flatMap((item) => {
        const file = this.files.get(item.fileName);
        return file ? [{ uri: file.uri, range: this.range(file.uri, item.textSpan) }] : [];
      });
  }

  prepareRename(uri: string, at: number) {
    const info = this.service.getRenameInfo(fileName(uri), at, { allowRenameOfImportPath: false });
    if (!info.canRename || !this.definition(uri, at).length) return null;
    return { range: this.range(uri, info.triggerSpan), placeholder: info.displayName };
  }

  rename(uri: string, at: number, name: string) {
    if (
      !/^[$A-Z_a-z][$\w]*$/.test(name) ||
      ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, name).scan() !==
        ts.SyntaxKind.Identifier ||
      !this.prepareRename(uri, at)
    )
      return null;
    const changes: Record<
      string,
      { range: ReturnType<JavaScriptIntelligence["range"]>; newText: string }[]
    > = {};
    for (const item of this.service.findRenameLocations(fileName(uri), at, false, false, {
      providePrefixAndSuffixTextForRename: true,
    }) ?? []) {
      const file = this.files.get(item.fileName);
      if (!file) continue;
      (changes[file.uri] ??= []).push({
        range: this.range(file.uri, item.textSpan),
        newText: `${item.prefixText ?? ""}${name}${item.suffixText ?? ""}`,
      });
    }
    return { changes };
  }

  diagnostics(uri: string, limit = 40) {
    return this.service
      .getSemanticDiagnostics(fileName(uri))
      .filter((item) => item.start !== undefined && item.length !== undefined)
      .slice(0, limit)
      .map((item) => ({
        range: this.range(uri, { start: item.start!, length: item.length! }),
        severity: 2,
        source: "JavaScript",
        code: item.code,
        message: ts.flattenDiagnosticMessageText(item.messageText, "\n"),
      }));
  }
}
