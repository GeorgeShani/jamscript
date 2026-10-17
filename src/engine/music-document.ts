import { javascriptLanguage } from "@codemirror/lang-javascript";
import type { SyntaxNode } from "@lezer/common";

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
  steps: (SourceRange & { sound: string | null })[];
}
export type MusicLens = ParamLens | RhythmLens;
export interface MusicTrack {
  name: string;
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

function children(node: SyntaxNode) {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

/** Only direct function calls and ordinary dot chains are eligible for controls. */
function calls(node: SyntaxNode | null, source: string): Call[] {
  if (node?.name !== "CallExpression") return [];
  const callee = node.firstChild;
  const args = node.getChild("ArgList");
  if (!callee || !args) return [];
  const expressions = children(args).filter((arg) => !["(", ")", ","].includes(arg.name));
  if (callee.name === "VariableName")
    return [{ name: source.slice(callee.from, callee.to), args: expressions }];
  if (callee.name !== "MemberExpression" || !callee.getChild(".")) return [];
  const name = callee.getChild("PropertyName");
  const chain = calls(callee.firstChild, source);
  return name && chain.length
    ? [...chain, { name: source.slice(name.from, name.to), args: expressions }]
    : [];
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
  labels.forEach((statement, index) => {
    const track = names[index];
    if (!track || names.filter((name) => name === track).length !== 1) return;
    const expression = statement.getChild("ExpressionStatement")?.firstChild ?? null;
    const chain = calls(expression, source);
    const lenses: MusicLens[] = [];
    const root = chain[0];
    const string = root?.args[0];
    if (
      (root?.name === "s" || root?.name === "sound") &&
      root.args.length === 1 &&
      string?.name === "String"
    ) {
      const raw = source.slice(string.from + 1, string.to - 1);
      const matches = [...raw.matchAll(/\S+/g)];
      const locked =
        !matches.length ||
        matches.length > 16 ||
        matches.some((match) => !/^(?:[A-Za-z_][\w-]*(?::\d+)?|~)$/.test(match[0])) ||
        raw.includes("\\");
      lenses.push({
        kind: "rhythm",
        id: `${track}/rhythm`,
        track,
        from: string.from,
        to: string.to,
        locked,
        defaultSound:
          matches.find((match) => match[0] !== "~")?.[0] ?? (track === "hats" ? "hh" : "bd"),
        steps: locked
          ? []
          : matches.map((match) => ({
              from: string.from + 1 + match.index!,
              to: string.from + 1 + match.index! + match[0].length,
              sound: match[0] === "~" ? null : match[0],
            })),
      });
    }
    for (const call of chain.slice(1)) {
      if (!(call.name in PARAMS) || chain.filter((other) => other.name === call.name).length !== 1)
        continue;
      const arg = call.args[0];
      if (call.args.length !== 1 || arg?.name !== "Number") continue;
      const name = call.name as ParamName;
      const value = Number(source.slice(arg.from, arg.to));
      if (!Number.isFinite(value) || value < PARAMS[name].min || value > PARAMS[name].max) continue;
      lenses.push({
        kind: "param",
        id: `${track}/param/${name}`,
        track,
        name,
        value,
        from: arg.from,
        to: arg.to,
      });
    }
    if (lenses.length)
      tracks.push({
        name: track,
        from: statement.from,
        to: statement.to,
        color: (index % 6) + 1,
        lenses,
      });
  });
  return { valid: true, tracks, tempo };
}

function signature(lens: MusicLens) {
  return lens.kind === "param"
    ? `${lens.name}:${lens.value}`
    : JSON.stringify([lens.locked, lens.steps.map((step) => step.sound)]);
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
    if (!step) return null;
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
