import { javascriptLanguage } from "@codemirror/lang-javascript";
import type { SyntaxNode } from "@lezer/common";

export interface MixTrack {
  id: string;
  name: string;
  orbit: number;
  from: number;
  to: number;
}

interface Target extends MixTrack {
  expression: SyntaxNode;
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
export function prepareMix(source: string): { code: string; tracks: MixTrack[] } {
  const tree = javascriptLanguage.parser.parse(source);
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
        const prefix = source.slice(previous, expression.from);
        const comment = [...prefix.matchAll(/\/\/\s*([^\r\n]+)/g)].at(-1)?.[1]?.trim();
        add(comment ?? `Track ${targets.length + 1}`, expression);
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
