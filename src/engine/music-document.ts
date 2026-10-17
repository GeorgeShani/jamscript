import { javascriptLanguage } from "@codemirror/lang-javascript";
import type { SyntaxNode } from "@lezer/common";
import { prepareMix } from "./mix-source";

export interface SourceRange {
  from: number;
  to: number;
}
export const PARAMS = {
  gain: { min: 0, max: 1, step: 0.01, log: false },
  room: { min: 0, max: 1, step: 0.01, log: false },
  lpf: { min: 50, max: 20000, step: 10, log: true },
  hpf: { min: 50, max: 20000, step: 10, log: true },
} as const;
export type ParamName = keyof typeof PARAMS;
interface LensBase extends SourceRange {
  id: string;
  track: string;
}
export interface ParamLens extends LensBase {
  kind: "param";
  name: ParamName;
  value: number;
}
export interface RhythmLens extends LensBase {
  kind: "rhythm";
  locked: boolean;
  defaultSound: string;
  steps: (SourceRange & { sound: string | null; substeps?: (string | null)[] })[];
}
export type MusicLens = ParamLens | RhythmLens;
export interface MusicTrack {
  name: string;
  orbit: number;
  from: number;
  to: number;
  color: number;
  lenses: MusicLens[];
}
export interface MusicDocument {
  valid: boolean;
  tracks: MusicTrack[];
  tempo: number | null;
}
export type LensEdit = { target: string; value: number } | { target: string; step: number };
export interface SourcePatch extends SourceRange {
  insert: string;
}
interface Call {
  name: string;
  args: SyntaxNode[];
}

const PATTERN_ROOTS = new Set(["s", "sound", "n", "note", "chord", "stack", "arrange", "cat"]);

const SIMPLE_SOUND = /^(?:[A-Za-z_][\w-]*(?::\d+)?|~)$/;

function rhythmToken(token: string): { sound: string | null; substeps?: (string | null)[] } | null {
  if (SIMPLE_SOUND.test(token)) return { sound: token === "~" ? null : token };
  if (!token.startsWith("[") || !token.endsWith("]")) return null;
  const body = token.slice(1, -1);
  if (body.includes("[") || body.includes("]")) return null;
  const subdivisions = body.trim().split(/\s+/);
  if (
    subdivisions.length < 2 ||
    subdivisions.length > 8 ||
    !subdivisions.every((part) => SIMPLE_SOUND.test(part))
  )
    return null;
  return { sound: token, substeps: subdivisions.map((part) => (part === "~" ? null : part)) };
}

function children(node: SyntaxNode) {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

function nodeAtRange(node: SyntaxNode, from: number, to: number): SyntaxNode | null {
  if (node.from === from && node.to === to) return node;
  for (const child of children(node)) {
    if (child.from <= from && child.to >= to) {
      const found = nodeAtRange(child, from, to);
      if (found) return found;
    }
  }
  return null;
}

/** Only direct calls and dot chains on known pattern declarations are eligible. */
function calls(node: SyntaxNode | null, source: string, references = new Set<string>()): Call[] {
  if (node?.name !== "CallExpression") return [];
  const callee = node.firstChild;
  const args = node.getChild("ArgList");
  if (!callee || !args) return [];
  const expressions = children(args).filter(
    (arg) => !["(", ")", ",", "LineComment", "BlockComment"].includes(arg.name),
  );
  if (callee.name === "VariableName")
    return [{ name: source.slice(callee.from, callee.to), args: expressions }];
  if (callee.name !== "MemberExpression" || !callee.getChild(".")) return [];
  const name = callee.getChild("PropertyName");
  const base = callee.firstChild;
  const chain = calls(base, source, references);
  if (!chain.length && base?.name === "VariableName") {
    const reference = source.slice(base.from, base.to);
    if (references.has(reference) && name)
      return [
        { name: reference, args: [] },
        { name: source.slice(name.from, name.to), args: expressions },
      ];
  }
  return name && chain.length
    ? [...chain, { name: source.slice(name.from, name.to), args: expressions }]
    : [];
}

function patternReferences(
  statements: SyntaxNode[],
  tree: ReturnType<typeof javascriptLanguage.parser.parse>,
  source: string,
) {
  const declarations = statements.flatMap((statement) => {
    if (statement.name !== "VariableDeclaration") return [];
    const definition = statement.getChild("VariableDefinition");
    const expression = children(statement).find((node) => node.name === "CallExpression");
    return definition && expression
      ? [{ name: source.slice(definition.from, definition.to), statement, expression }]
      : [];
  });
  const counts = new Map<string, number>();
  const assigned = new Set<string>();
  tree.iterate({
    enter(node) {
      if (node.name === "VariableDefinition") {
        const name = source.slice(node.from, node.to);
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      if (node.name === "AssignmentExpression" && node.node.firstChild?.name === "VariableName")
        assigned.add(source.slice(node.node.firstChild.from, node.node.firstChild.to));
    },
  });
  const references = new Set<string>();
  for (let pass = 0; pass < declarations.length; pass++) {
    let changed = false;
    for (const declaration of declarations) {
      if (counts.get(declaration.name) !== 1 || assigned.has(declaration.name)) continue;
      const root = calls(declaration.expression, source, references)[0]?.name;
      if (
        root &&
        (PATTERN_ROOTS.has(root) || references.has(root)) &&
        !references.has(declaration.name)
      ) {
        references.add(declaration.name);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { references, declarations };
}

function chainsIn(
  expression: SyntaxNode | null,
  source: string,
  references: Set<string>,
  path = "",
) {
  const result: { chain: Call[]; path: string }[] = [];
  const chain = calls(expression, source, references);
  if (chain.length) result.push({ chain, path });
  if (chain[0]?.name === "stack") {
    chain[0].args.forEach((argument, index) => {
      if (argument.name === "CallExpression")
        result.push(...chainsIn(argument, source, references, `${path}layer/${index}/`));
    });
  }
  return result;
}

/** Pure, full-document analysis. Invalid source never yields editable ranges. */
export function deriveMusic(source: string): MusicDocument {
  const tree = javascriptLanguage.parser.parse(source);
  let invalid = false;
  tree.iterate({
    enter(node) {
      if (node.type.isError) invalid = true;
    },
  });
  if (invalid) return { valid: false, tracks: [], tempo: null };
  const statements = children(tree.topNode);
  const { references, declarations } = patternReferences(statements, tree, source);
  const labels = statements.filter((node) => node.name === "LabeledStatement");
  const names = labels.map((node) =>
    source.slice(node.getChild("Label")!.from, node.getChild("Label")!.to),
  );
  const tracks: MusicTrack[] = [];
  let tempo: number | null = null;
  for (const statement of statements) {
    if (statement.name !== "ExpressionStatement") continue;
    const chain = calls(statement.firstChild, source);
    const arg = chain[0]?.args[0];
    if (chain.length === 1 && chain[0]?.name === "setcps" && arg?.name === "Number") {
      const value = Number(source.slice(arg.from, arg.to));
      if (Number.isFinite(value) && value > 0) tempo = value;
    }
  }
  const mixTargets = prepareMix(source, tree).tracks;
  const targets = labels.length
    ? labels.map((statement, index) => ({
        name: names[index],
        from: statement.from,
        to: statement.to,
        expression: statement.getChild("ExpressionStatement")?.firstChild ?? null,
        orbit: 64 + index,
      }))
    : mixTargets.length
      ? mixTargets.map((track) => ({
          name: track.name,
          from: track.from,
          to: track.to,
          expression: nodeAtRange(tree.topNode, track.from, track.to),
          orbit: track.orbit,
        }))
      : declarations
          .filter((declaration) => references.has(declaration.name))
          .map((declaration, index) => ({
            name: declaration.name,
            from: declaration.statement.from,
            to: declaration.statement.to,
            expression: declaration.expression,
            orbit: 64 + index,
          }));
  targets.forEach((target, index) => {
    const track = target.name;
    if (!track || (labels.length && names.filter((name) => name === track).length !== 1)) return;
    const expression = target.expression;
    const lenses: MusicLens[] = [];
    for (const { chain, path } of chainsIn(expression, source, references)) {
      const idBase = `${track}/${path}`;
      const root = chain[0];
      const string = root?.args[0];
      if (
        (root?.name === "s" || root?.name === "sound") &&
        root.args.length === 1 &&
        string?.name === "String"
      ) {
        const raw = source.slice(string.from + 1, string.to - 1);
        const matches = [...raw.matchAll(/\[[^\]]+\]|\S+/g)];
        const tokens = matches.map((match) => rhythmToken(match[0]));
        const locked =
          !matches.length ||
          matches.length > 16 ||
          tokens.some((token) => !token) ||
          raw.includes("\\");
        const firstSound = tokens
          .flatMap((token) => token?.substeps ?? (token?.sound ? [token.sound] : []))
          .find((sound) => sound !== null);
        lenses.push({
          kind: "rhythm",
          id: `${idBase}rhythm`,
          track,
          from: string.from,
          to: string.to,
          locked,
          defaultSound: firstSound ?? (track === "hats" ? "hh" : "bd"),
          steps: locked
            ? []
            : matches.map((match, step) => ({
                from: string.from + 1 + match.index!,
                to: string.from + 1 + match.index! + match[0].length,
                ...tokens[step]!,
              })),
        });
      }
      for (const call of chain.slice(1)) {
        if (
          !(call.name in PARAMS) ||
          chain.filter((other) => other.name === call.name).length !== 1
        )
          continue;
        const arg = call.args[0];
        if (call.args.length !== 1 || arg?.name !== "Number") continue;
        const name = call.name as ParamName;
        const value = Number(source.slice(arg.from, arg.to));
        if (!Number.isFinite(value) || value < PARAMS[name].min || value > PARAMS[name].max)
          continue;
        lenses.push({
          kind: "param",
          id: `${idBase}param/${name}`,
          track,
          name,
          value,
          from: arg.from,
          to: arg.to,
        });
      }
    }
    if (lenses.length)
      tracks.push({
        name: track,
        orbit: target.orbit,
        from: target.from,
        to: target.to,
        color: (index % 6) + 1,
        lenses,
      });
  });
  return { valid: true, tracks, tempo };
}

function signature(lens: MusicLens) {
  return lens.kind === "param"
    ? `${lens.name}:${lens.value}`
    : JSON.stringify([lens.locked, lens.steps.map((step) => [step.sound, step.substeps])]);
}

/** Re-derive each target before editing, then check the result and all other lenses. */
export function lensPatch(source: string, edit: LensEdit): SourcePatch | null {
  const before = deriveMusic(source);
  const lenses = before.tracks.flatMap((track) => track.lenses);
  const lens = lenses.find((item) => item.id === edit.target);
  if (!before.valid || !lens) return null;
  let patch: SourcePatch;
  if (lens.kind === "param" && "value" in edit) {
    const spec = PARAMS[lens.name];
    if (!Number.isFinite(edit.value) || edit.value < spec.min || edit.value > spec.max) return null;
    const value = Math.round(edit.value * 100) / 100;
    if (value === lens.value) return null;
    patch = { from: lens.from, to: lens.to, insert: String(value) };
  } else if (
    lens.kind === "rhythm" &&
    "step" in edit &&
    !lens.locked &&
    Number.isInteger(edit.step)
  ) {
    const step = lens.steps[edit.step];
    if (!step || step.substeps) return null;
    patch = { from: step.from, to: step.to, insert: step.sound ? "~" : lens.defaultSound };
  } else return null;
  const result = source.slice(0, patch.from) + patch.insert + source.slice(patch.to);
  const after = deriveMusic(result);
  const next = after.tracks.flatMap((track) => track.lenses);
  if (
    !after.valid ||
    next.length !== lenses.length ||
    !next.some((item) => item.id === edit.target)
  )
    return null;
  if (
    lenses.some((item) => {
      const other = next.find((candidate) => candidate.id === item.id);
      return !other || (item.id !== edit.target && signature(item) !== signature(other));
    })
  )
    return null;
  return patch;
}
