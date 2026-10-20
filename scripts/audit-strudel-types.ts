import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { JavaScriptIntelligence } from "../src/features/language/javascript-intelligence";

// Explicit runtime requirements, not diagnostic suppressions. The IDE still
// reports these unavailable APIs; the audit lists every excluded example.
function externalRequirement(source: string) {
  if (/\.osc\(/.test(source)) return "Optional OSC extension is not installed";
  if (/\.midi\(/.test(source)) return "Optional MIDI extension is not installed";
  if (/\._(?:spectrum|pitchwheel|spiral)\(/.test(source))
    return "External Strudel REPL visualization hook";
  if (/\bslider\(/.test(source)) return "External Strudel REPL slider widget";
  if (/register\(['"]vlpf['"]/.test(source))
    return "Custom runtime-registered method needs document-specific declarations";
  return null;
}

export function upstreamExamples() {
  const root = fileURLToPath(new URL("../node_modules/@strudel/", import.meta.url));
  const examples: { file: string; source: string }[] = [];
  const seen = new Set<string>();
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (["dist", "test", "node_modules"].includes(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        scan(file);
        continue;
      }
      if (!file.endsWith(".mjs")) continue;
      const tree = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
      );
      function visit(node: ts.Node) {
        for (const tag of ts.getJSDocTags(node)) {
          if (tag.tagName.text !== "example" || typeof tag.comment !== "string") continue;
          const source = tag.comment.replace(/^```[^\n]*\n|\n```\s*$/g, "").trim();
          if (!source || seen.has(source)) continue;
          seen.add(source);
          examples.push({ file: relative(root, file).replaceAll("\\", "/"), source });
        }
        ts.forEachChild(node, visit);
      }
      visit(tree);
    }
  }
  for (const pkg of ["core", "webaudio", "tonal", "mini", "draw"]) scan(join(root, pkg));
  return examples;
}

export function auditExamples() {
  let source = "";
  const all = upstreamExamples();
  const excluded = all.flatMap((example) => {
    const reason = externalRequirement(example.source);
    return reason ? [{ ...example, reason }] : [];
  });
  const examples = all
    .filter((example) => !externalRequirement(example.source))
    .map((example) => {
      const start = source.split("\n").length + 1;
      source += `\n{\n${example.source}\n}\n`;
      return { ...example, start, end: source.split("\n").length };
    });
  const service = new JavaScriptIntelligence();
  try {
    const uri = "file:///upstream-examples.js";
    service.update(uri, source, 1);
    const diagnostics = service.diagnostics(uri, Infinity).map((diagnostic) => ({
      ...diagnostic,
      example: examples.find(
        (example) =>
          diagnostic.range.start.line >= example.start && diagnostic.range.start.line < example.end,
      ),
    }));
    return { examples, excluded, diagnostics };
  } finally {
    service.dispose();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = auditExamples();
  console.log(
    JSON.stringify(
      {
        examples: audit.examples.length,
        excluded: process.argv.includes("--json") ? audit.excluded : audit.excluded.length,
        exclusions: [...new Set(audit.excluded.map((example) => example.reason))],
        diagnostics: audit.diagnostics.length,
        failures: audit.diagnostics,
      },
      null,
      2,
    ),
  );
  process.exitCode = audit.diagnostics.length ? 1 : 0;
}
