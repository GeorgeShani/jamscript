import { javascriptLanguage } from "@codemirror/lang-javascript";
import type { SyntaxNode, Tree } from "@lezer/common";

export interface MixTrack {
  id: string;
  name: string;
  orbit: number;
  from: number;
  to: number;
}

export interface MixSourcePatch {
  from: number;
  to: number;
  insert: string;
}

/** Convert a source location in orbit-augmented playback code to the editor document. */
export function editorOffsetFromPlayback(offset: number, tracks: MixTrack[]): number | null {
  if (!Number.isInteger(offset) || offset < 0) return null;
  const insertions = tracks
    .flatMap((track) => [
      { at: track.from, length: 1 },
      { at: track.to, length: `).orbit(${track.orbit})`.length },
    ])
    .sort((a, b) => a.at - b.at);
  let added = 0;
  for (const insertion of insertions) {
    const at = insertion.at + added;
    if (offset < at) break;
    if (offset < at + insertion.length) return null;
    added += insertion.length;
  }
  return offset - added;
}

interface Target extends MixTrack {
  expression: SyntaxNode;
}

interface TrackComment {
  from: number;
  to: number;
  name: string;
}

function lastLineComment(source: string, from: number, to: number): TrackComment | null {
  const match = [...source.slice(from, to).matchAll(/\/\/[^\r\n]*/g)].at(-1);
  return match
    ? {
        from: from + match.index!,
        to: from + match.index! + match[0].length,
        name: match[0].slice(2).trim(),
      }
    : null;
}

function nestedStackComment(expression: SyntaxNode, source: string): TrackComment | null {
  const args = stackCall(expression, source)?.getChild("ArgList");
  if (!args) return null;
  const first = children(args).find(
    (node) => !["(", ")", ",", "LineComment", "BlockComment"].includes(node.name),
  );
  return first ? lastLineComment(source, args.from, first.from) : null;
}

function children(node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

function stackCall(node: SyntaxNode | null, source: string): SyntaxNode | null {
  if (!node) return null;
  if (node.name === "CallExpression") {
    const callee = node.firstChild;
    if (callee?.name === "VariableName" && source.slice(callee.from, callee.to) === "stack")
      return node;
    if (callee?.name === "MemberExpression") return stackCall(callee.firstChild, source);
  }
  return null;
}

/** Build playback-only orbit assignments. The CodeMirror document is never changed. */
export function prepareMix(
  source: string,
  parsedTree?: Tree,
): { code: string; tracks: MixTrack[] } {
  const tree = parsedTree ?? javascriptLanguage.parser.parse(source);
  let invalid = false;
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) invalid = true;
    },
  });
  if (invalid) return { code: source, tracks: [] };

  const targets: Target[] = [];
  const names = new Set<string>();
  const add = (name: string, expression: SyntaxNode) => {
    const base = name.trim() || `Track ${targets.length + 1}`;
    let unique = base;
    for (let suffix = 2; names.has(unique); suffix++) unique = `${base} ${suffix}`;
    names.add(unique);
    targets.push({
      id: unique,
      name: unique,
      orbit: 64 + targets.length,
      from: expression.from,
      to: expression.to,
      expression,
    });
  };

  const statements = children(tree.topNode);
  for (const statement of statements) {
    if (statement.name !== "LabeledStatement") continue;
    const label = statement.getChild("Label");
    const expression = statement.getChild("ExpressionStatement")?.firstChild;
    if (label && expression) add(source.slice(label.from, label.to), expression);
  }
  if (targets.length === 0) {
    for (const statement of statements) {
      if (statement.name !== "ExpressionStatement") continue;
      const call = stackCall(statement.firstChild, source);
      const args = call?.getChild("ArgList");
      if (!args) continue;
      const expressions = children(args).filter(
        (node) => !["(", ")", ",", "LineComment", "BlockComment"].includes(node.name),
      );
      if (expressions.length < 2) continue;
      let previous = args.from;
      for (const expression of expressions) {
        const comment =
          lastLineComment(source, previous, expression.from) ??
          nestedStackComment(expression, source);
        add(comment?.name ?? `Track ${targets.length + 1}`, expression);
        previous = expression.to;
      }
      break;
    }
  }

  let code = source;
  for (const target of [...targets].sort((a, b) => b.from - a.from)) {
    code =
      code.slice(0, target.from) +
      `(${source.slice(target.from, target.to)}).orbit(${target.orbit})` +
      code.slice(target.to);
  }
  return { code, tracks: targets.map(({ expression: _expression, ...track }) => track) };
}

/** Rename one syntax-derived track, then verify that the rest of the mix is unchanged. */
export function renameTrackPatch(
  source: string,
  id: string,
  requestedName: string,
): MixSourcePatch | null {
  const name = requestedName.trim();
  if (!/^[\p{L}\p{N}_][\p{L}\p{N}_ -]{0,39}$/u.test(name)) return null;
  const tree = javascriptLanguage.parser.parse(source);
  const before = prepareMix(source, tree).tracks;
  const index = before.findIndex((track) => track.id === id);
  const target = before[index];
  if (
    !target ||
    target.name === name ||
    before.some(
      (track, other) => other !== index && track.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return null;

  let patch: MixSourcePatch | null = null;
  const statements = children(tree.topNode);
  const labelStatement = statements.find((statement) => {
    const expression = statement.getChild("ExpressionStatement")?.firstChild;
    return statement.name === "LabeledStatement" && expression?.from === target.from;
  });
  if (labelStatement) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
    const label = labelStatement.getChild("Label");
    if (label) patch = { from: label.from, to: label.to, insert: name };
  } else {
    for (const statement of statements) {
      if (statement.name !== "ExpressionStatement") continue;
      const args = stackCall(statement.firstChild, source)?.getChild("ArgList");
      if (!args) continue;
      const expressions = children(args).filter(
        (node) => !["(", ")", ",", "LineComment", "BlockComment"].includes(node.name),
      );
      let previous = args.from;
      for (const expression of expressions) {
        if (expression.from === target.from && expression.to === target.to) {
          const comment =
            lastLineComment(source, previous, expression.from) ??
            nestedStackComment(expression, source);
          if (comment) {
            patch = {
              from: comment.from,
              to: comment.to,
              insert: `// ${name}`,
            };
          } else {
            const lineStart = source.lastIndexOf("\n", expression.from - 1) + 1;
            const beforeExpression = source.slice(lineStart, expression.from);
            const indent = /^\s*$/.test(beforeExpression) ? beforeExpression : "  ";
            const newline = source.includes("\r\n") ? "\r\n" : "\n";
            patch = {
              from: expression.from,
              to: expression.from,
              insert: `// ${name}${newline}${indent}`,
            };
          }
          break;
        }
        previous = expression.to;
      }
      if (patch) break;
    }
  }
  if (!patch) return null;
  const result = source.slice(0, patch.from) + patch.insert + source.slice(patch.to);
  const after = prepareMix(result).tracks;
  if (
    after.length !== before.length ||
    after[index]?.name !== name ||
    before.some((track, other) => other !== index && after[other]?.name !== track.name)
  )
    return null;
  return patch;
}
