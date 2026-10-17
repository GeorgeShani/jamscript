import { javascriptLanguage } from "@codemirror/lang-javascript";
import type { SyntaxNode } from "@lezer/common";
import type { SourcePatch, SourceRange } from "@/engine/music-document";

export interface TempoState {
  cps: number | null;
  editable: boolean;
}

export function bpmToCps(bpm: number, beatsPerCycle = 4): number | null {
  return positive(bpm) && positive(beatsPerCycle) ? checked(bpm / 60 / beatsPerCycle) : null;
}

export function cpsToBpm(cps: number, beatsPerCycle = 4): number | null {
  return positive(cps) && positive(beatsPerCycle) ? checked(cps * 60 * beatsPerCycle) : null;
}

function positive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function checked(value: number) {
  return positive(value) ? value : null;
}

function children(node: SyntaxNode) {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result.filter((child) => !["LineComment", "BlockComment"].includes(child.name));
}

interface TempoTarget extends TempoState {
  range: SourceRange | null;
  cpsPerUnit: number;
  insertAt: number;
}

function inspectTempo(source: string): TempoTarget {
  const unavailable: TempoTarget = {
    cps: null,
    editable: false,
    range: null,
    cpsPerUnit: 1,
    insertAt: 0,
  };
  const tree = javascriptLanguage.parser.parse(source);
  let invalid = false;
  const identifiers: SyntaxNode[] = [];
  tree.iterate({
    enter(node) {
      if (node.type.isError) invalid = true;
      if (
        ["VariableName", "VariableDefinition"].includes(node.name) &&
        ["setcps", "setcpm"].includes(source.slice(node.from, node.to))
      )
        identifiers.push(node.node);
    },
  });
  if (invalid) return unavailable;
  if (!identifiers.length) {
    const firstStatement = children(tree.topNode).find(
      (node) => !(node.name === "ExpressionStatement" && node.firstChild?.name === "String"),
    );
    return { ...unavailable, editable: true, insertAt: firstStatement?.from ?? source.length };
  }
  if (identifiers.length !== 1) return unavailable;
  const identifier = identifiers[0]!;
  const call = identifier.parent;
  if (
    call?.name !== "CallExpression" ||
    call.firstChild?.from !== identifier.from ||
    call.parent?.name !== "ExpressionStatement" ||
    call.parent.parent?.name !== "Script"
  )
    return unavailable;
  const args = call.getChild("ArgList");
  if (!args) return unavailable;
  const expressions = children(args).filter((node) => !["(", ")", ","].includes(node.name));
  if (expressions.length !== 1) return unavailable;
  let literal = expressions[0]!;
  let divisor = 1;
  if (literal.name === "BinaryExpression") {
    const parts = children(literal);
    if (
      parts.length !== 3 ||
      parts[0]?.name !== "Number" ||
      parts[2]?.name !== "Number" ||
      source.slice(parts[1]!.from, parts[1]!.to) !== "/"
    )
      return unavailable;
    divisor = Number(source.slice(parts[2].from, parts[2].to).replaceAll("_", ""));
    literal = parts[0];
  }
  if (literal.name !== "Number" || !positive(divisor)) return unavailable;
  const value = Number(source.slice(literal.from, literal.to).replaceAll("_", ""));
  const cpsPerUnit =
    (source.slice(identifier.from, identifier.to) === "setcpm" ? 1 / 60 : 1) / divisor;
  const cps = value * cpsPerUnit;
  if (!positive(value) || !positive(cps)) return unavailable;
  return {
    cps,
    editable: true,
    range: { from: literal.from, to: literal.to },
    cpsPerUnit,
    insertAt: 0,
  };
}

export function readTempo(source: string): TempoState {
  const { cps, editable } = inspectTempo(source);
  return { cps, editable };
}

/** Only a proven literal range (or a new top-level tempo declaration) is changed. */
export function tempoPatch(source: string, cps: number): SourcePatch | null {
  const target = inspectTempo(source);
  if (!target.editable || !positive(cps) || target.cps === cps) return null;
  const value = cps / target.cpsPerUnit;
  if (!positive(value)) return null;
  let insert = String(Number(value.toPrecision(12)));
  let range = target.range;
  if (range) {
    if (source.slice(range.from, range.to).startsWith(".")) insert = insert.replace(/^0\./, ".");
  } else {
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const prefix = target.insertAt > 0 && source[target.insertAt - 1] !== "\n" ? newline : "";
    insert = `${prefix}setcps(${insert});${newline}`;
    range = { from: target.insertAt, to: target.insertAt };
  }
  const result = source.slice(0, range.from) + insert + source.slice(range.to);
  const after = readTempo(result);
  if (!after.editable || after.cps === null || Math.abs(after.cps - cps) > cps * 1e-10) return null;
  return { ...range, insert };
}
