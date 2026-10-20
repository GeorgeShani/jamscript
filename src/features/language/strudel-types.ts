import api from "./strudel-api.generated.json";
import { docs } from "./strudel-docs";

type Parameter = {
  name: string;
  type: string;
  optional?: boolean;
  rest?: boolean;
  description?: string;
};
type Typing = { kind: string; parameters: Parameter[]; returns: string; parametersKnown?: boolean };
const typing: Record<string, Typing> = api.typing;
const methodTyping: Record<string, Typing> = api.methodTyping;

// Pattern inputs deliberately include mini-notation. A numeric control's string
// notation is evaluated by Strudel, not JavaScript's number parser.
const foundation = `
type PatternInput<T = unknown> = T | string | Pattern<T> | readonly PatternInput<T>[];
// Pattern values are computed at runtime; an opaque transformed pattern is a
// supported argument, not proof that its eventual numeric/string value is wrong.
type PatternArgument<T = unknown> = PatternInput<T> | Pattern<unknown>;
type PatternTransform<T = unknown> = (pattern: Pattern<T>) => Pattern<T>;
type MiniNotationLetter = "a"|"b"|"c"|"d"|"e"|"f"|"g"|"h"|"i"|"j"|"k"|"l"|"m"|"n"|"o"|"p"|"q"|"r"|"s"|"t"|"u"|"v"|"w"|"x"|"y"|"z";
type MiniNotationValue<Text extends string> = string extends Text ? unknown : Lowercase<Text> extends \`\${string}\${MiniNotationLetter}\${string}\` ? string : number;
interface PatternOperator<T> {
  (value: PatternArgument<unknown>): Pattern<T>;
  in(value: PatternArgument<unknown>): Pattern<T>;
  out(value: PatternArgument<unknown>): Pattern<T>;
  mix(value: PatternArgument<unknown>): Pattern<T>;
  squeeze(value: PatternArgument<unknown>): Pattern<T>;
  squeezeout(value: PatternArgument<unknown>): Pattern<T>;
  reset(value: PatternArgument<unknown>): Pattern<T>;
  restart(value: PatternArgument<unknown>): Pattern<T>;
  poly(value: PatternArgument<unknown>): Pattern<T>;
}
interface ControlMap { s?: string; n?: number; note?: string | number; gain?: number; velocity?: number; pan?: number; lpf?: number; room?: number; [control: string]: unknown }
type Fraction = number & { valueOf(): number; toString(): string; add(value: number | Fraction): Fraction; sub(value: number | Fraction): Fraction; mul(value: number | Fraction): Fraction; div(value: number | Fraction): Fraction; };
interface TimeSpan { begin: Fraction; end: Fraction; readonly duration: Fraction; readonly spanCycles: TimeSpan[]; withTime(transform: (time: Fraction) => number | Fraction): TimeSpan; }
interface Hap<T = unknown> { whole: TimeSpan | undefined; part: TimeSpan; value: T; context: { locations?: { start: number; end: number }[]; tags?: string[]; [key: string]: unknown }; stateful: boolean; readonly duration: Fraction; wholeOrPart(): TimeSpan; withValue<U>(transform: (value: T) => U): Hap<U>; hasTag(tag: string): boolean | undefined; hasOnset(): boolean; }
interface QueryState { span: TimeSpan; controls: ControlMap; setSpan(span: TimeSpan): QueryState; withSpan(transform: (span: TimeSpan) => TimeSpan): QueryState; setControls(controls: ControlMap): QueryState; }
declare const Pattern: { new<T>(query: (state: QueryState) => Hap<T>[], steps?: number | Fraction): Pattern<T>; };
declare const Hap: { new<T>(whole: TimeSpan | undefined, part: TimeSpan, value: T, context?: Hap<T>['context'], stateful?: boolean): Hap<T>; };
declare const TimeSpan: { new(begin: number | Fraction, end: number | Fraction): TimeSpan; };
declare const State: { new(span: TimeSpan, controls?: ControlMap): QueryState; };
declare const Fraction: { (numerator: number | string | Fraction, denominator?: number): Fraction; new(numerator: number | string | Fraction, denominator?: number): Fraction; };
type SampleBank = string | readonly string[] | { [note: string]: string | readonly string[] };
interface SampleMap { _base?: string; [sound: string]: SampleBank | undefined; }
interface SampleOptions { prebake?: boolean; tag?: string; }
`;

const methodOverrides: Record<string, string> = {
  withValue: "withValue<U>(transform: (value: T) => U): Pattern<U>;",
  fmap: "fmap<U>(transform: (value: T) => U): Pattern<U>;",
  filterValues: "filterValues(predicate: (value: T) => boolean): Pattern<T>;",
  filterHaps: "filterHaps(predicate: (hap: Hap<T>) => unknown): Pattern<T>;",
  filter: "filter(predicate: (hap: Hap<T>) => unknown): Pattern<T>;",
  filterWhen: "filterWhen(predicate: (time: Fraction) => unknown): Pattern<T>;",
  withHap: "withHap<U>(transform: (hap: Hap<T>) => Hap<U>): Pattern<U>;",
  withContext:
    "withContext(transform: (context: Hap<T>['context']) => Hap<T>['context']): Pattern<T>;",
  withQuerySpan: "withQuerySpan(transform: (span: TimeSpan) => TimeSpan): Pattern<T>;",
  pickF:
    "pickF(lookup: PatternArgument<unknown>, functions: readonly PatternTransform<T>[]): Pattern<T>;",
  pickmodF:
    "pickmodF(lookup: PatternArgument<unknown>, functions: readonly PatternTransform<T>[]): Pattern<T>;",
  lfo: "lfo(config?: Record<string, PatternInput<unknown>>, id?: PatternArgument<number | string>): Pattern<T>;",
  env: "env(config?: Record<string, PatternInput<unknown>>, id?: PatternArgument<number | string>): Pattern<T>;",
  bmod: "bmod(config?: Record<string, PatternInput<unknown>>, id?: PatternArgument<number | string>): Pattern<T>;",
  beat: "beat(steps: PatternArgument<number>, division: PatternArgument<number>): Pattern<T>;",
  // These two editor hooks are explicitly provided by JamScript's playback adapter.
  _scope: "_scope(...args: unknown[]): Pattern<T>;",
  _punchcard: "_punchcard(...args: unknown[]): Pattern<T>;",
  query: "query(state: QueryState): Hap<T>[];",
  queryArc:
    "queryArc(begin: number | Fraction, end: number | Fraction, controls?: ControlMap): Hap<T>[];",
  withState: "withState(transform: (state: QueryState) => QueryState): Pattern<T>;",
  // Strudel tests these values for truthiness (core/pattern.mjs: keepif/when).
  // Mini-notation transforms yield Pattern<unknown>; their values are not limited
  // to numbers/booleans (struct also supports tokens such as "x").
  when: "when(condition: PatternInput<unknown>, transform: PatternTransform<T>): Pattern<T>;",
  sometimes: "sometimes(transform: PatternTransform<T>): Pattern<T>;",
  rarely: "rarely(transform: PatternTransform<T>): Pattern<T>;",
  often: "often(transform: PatternTransform<T>): Pattern<T>;",
  almostAlways: "almostAlways(transform: PatternTransform<T>): Pattern<T>;",
  almostNever: "almostNever(transform: PatternTransform<T>): Pattern<T>;",
  sometimesBy:
    "sometimesBy(probability: PatternArgument<number>, transform: PatternTransform<T>): Pattern<T>;",
  every: "every(cycles: PatternArgument<number>, transform: PatternTransform<T>): Pattern<T>;",
  chunk: "chunk(count: PatternArgument<number>, transform: PatternTransform<T>): Pattern<T>;",
  off: "off(time: PatternArgument<number>, transform: PatternTransform<T>): Pattern<T>;",
  jux: "jux(transform: PatternTransform<T>): Pattern<T>;",
  set: "set<U>(other: PatternInput<U>): Pattern<T & U>;",
  range: "range(min: PatternArgument<number>, max: PatternArgument<number>): Pattern<number>;",
  rangex: "rangex(min: PatternArgument<number>, max: PatternArgument<number>): Pattern<number>;",
  range2: "range2(min: PatternArgument<number>, max: PatternArgument<number>): Pattern<number>;",
  ply: "ply(factor: PatternArgument<number>): Pattern<T>;",
  struct: "struct(...structure: PatternInput<unknown>[]): Pattern<T>;",
  mask: "mask(...mask: PatternInput<unknown>[]): Pattern<T>;",
};
for (const name of api.operators)
  methodOverrides[name] =
    name === "set"
      ? methodOverrides[name]!
      : name === "sub"
        ? "sub(value: PatternArgument<unknown>): Pattern<T>;"
        : `${name}: PatternOperator<T>;`;
const globalOverrides: Record<string, string> = {
  mini: "declare function mini<Text extends string>(notation: Text): Pattern<MiniNotationValue<Text>>;\ndeclare function mini(...notation: string[]): Pattern<unknown>;",
  m: "declare function m<Text extends string>(notation: Text, offset?: number): Pattern<MiniNotationValue<Text>>;",
  h: "declare function h<Text extends string>(notation: Text): Pattern<MiniNotationValue<Text>>;",
  minify: "declare function minify<T>(value: PatternInput<T>): Pattern<T>;",
  morph:
    "declare function morph(from: PatternArgument<readonly number[]>, to: PatternArgument<readonly number[]>, amount: PatternArgument<number>): Pattern<unknown>;",
  mask: "declare function mask(condition: PatternArgument<unknown>): <T>(pattern: PatternInput<T>) => Pattern<T>;\ndeclare function mask<T>(condition: PatternArgument<unknown>, pattern: PatternInput<T>): Pattern<T>;",
  struct:
    "declare function struct(condition: PatternArgument<unknown>): <T>(pattern: PatternInput<T>) => Pattern<T>;\ndeclare function struct<T>(condition: PatternArgument<unknown>, pattern: PatternInput<T>): Pattern<T>;",
  // signal.mjs reifies the bound, then joins numeric random-value patterns.
  irand: "declare function irand(max: PatternArgument<number>): Pattern<number>;",
  _irand: "declare function _irand(max: number): Pattern<number>;",
  brandBy: "declare function brandBy(probability: PatternArgument<number>): Pattern<boolean>;",
  run: "declare function run(count: PatternArgument<number>): Pattern<number>;",
  randrun: "declare function randrun(count: number): Pattern<number>;",
  randL: "declare function randL(count: PatternArgument<number>): Pattern<number[]>;",
  binary: "declare function binary(value: PatternArgument<number>): Pattern<number>;",
  binaryN:
    "declare function binaryN(value: PatternArgument<number>, bits?: PatternArgument<number>): Pattern<number>;",
  signal:
    "declare function signal<T>(sample: (time: Fraction, controls: ControlMap) => T): Pattern<T>;",
  steady: "declare function steady<T>(value: T): Pattern<T>;",
  binaryL: "declare function binaryL(value: PatternArgument<number>): Pattern<number[]>;",
  binaryNL:
    "declare function binaryNL(value: PatternArgument<number>, bits?: PatternArgument<number>): Pattern<number[]>;",
  partials:
    "declare function partials(values: readonly number[] | Pattern<unknown>): Pattern<ControlMap>;",
  phases:
    "declare function phases(values: readonly number[] | Pattern<unknown>): Pattern<ControlMap>;",
  squeeze:
    "declare function squeeze<U>(indices: PatternArgument<unknown>, choices: readonly PatternInput<U>[] | Record<string, PatternInput<U>>): Pattern<U>;",
  pure: "declare function pure<T>(value: T): Pattern<T>;",
  reify: "declare function reify<T>(value: PatternInput<T>): Pattern<T>;",
  samples:
    "declare function samples(source: string | SampleMap, baseUrl?: string, options?: SampleOptions): Promise<void>;",
  setcps: "declare function setcps(cyclesPerSecond: number): void;",
  setcpm: "declare function setcpm(cyclesPerMinute: number): void;",
  setbpm: "declare function setbpm(beatsPerMinute: number): void;",
  hush: "declare function hush(): void;",
};
for (const name of [
  "stack",
  "stackLeft",
  "stackRight",
  "stackCentre",
  "slowcat",
  "cat",
  "fastcat",
  "sequence",
  "seq",
  "polymeter",
  "pm",
  "polyrhythm",
  "pr",
]) {
  globalOverrides[name] =
    `declare function ${name}<Values extends readonly unknown[]>(...patterns: { [Index in keyof Values]: PatternInput<Values[Index]> }): Pattern<Values[number]>;`;
  if (api.methods.includes(name))
    methodOverrides[name] =
      `${name}<Values extends readonly unknown[]>(...patterns: { [Index in keyof Values]: PatternInput<Values[Index]> }): Pattern<T | Values[number]>;`;
}
for (const name of ["choose", "chooseIn", "chooseOut", "chooseCycles", "randcat"])
  globalOverrides[name] =
    `declare function ${name}<Values extends readonly unknown[]>(...values: { [Index in keyof Values]: PatternInput<Values[Index]> }): Pattern<Values[number]>;`;
for (const name of ["chooseWith", "chooseInWith"])
  globalOverrides[name] =
    `declare function ${name}<U>(selector: PatternArgument<number>, choices: readonly PatternInput<U>[]): Pattern<U>;`;
for (const name of [
  "pick",
  "pickmod",
  "pickOut",
  "pickmodOut",
  "pickRestart",
  "pickmodRestart",
  "pickReset",
  "pickmodReset",
  "inhabit",
])
  if (api.methods.includes(name))
    methodOverrides[name] =
      `${name}<U>(choices: readonly PatternInput<U>[] | Record<string, PatternInput<U>>): Pattern<U>;`;

function type(raw: string, input = false): string {
  const cleaned = raw.trim().replace(/^\.\.\./, "");
  const union = cleaned.split(/\s*\|\s*/).map((part): string => {
    if (/\[\]$/.test(part)) return `(${type(part.slice(0, -2))})[]`;
    if (/^(number|Number|integer)$/.test(part)) return "number";
    if (/^(string|String)$/.test(part)) return "string";
    if (/^(boolean|Boolean|bool)$/.test(part)) return "boolean";
    if (part === "Pattern") return "Pattern<unknown>";
    if (part === "Fraction") return "Fraction";
    if (part === "Hap") return "Hap<unknown>";
    if (/^(Function|function)$/.test(part))
      return input ? "PatternTransform<unknown>" : "((...args: unknown[]) => unknown)";
    if (/^(Object|object)$/.test(part)) return "Record<string, unknown>";
    if (part === "Array") return "unknown[]";
    if (/^(void|undefined|null)$/.test(part)) return part;
    return "unknown";
  });
  const normalized = [...new Set(union)].join(" | ");
  return input && !/^(Function|function)(\[\])?$/.test(cleaned)
    ? `PatternArgument<${union.filter((part) => !part.startsWith("Pattern<")).join(" | ") || "unknown"}>`
    : normalized;
}

function comment(name: string, parameters: Parameter[]) {
  const detail = docs[name]?.detail ?? "";
  return `/** ${detail.replace(/\*\//g, "")}\n${parameters.map((parameter) => ` * @param ${parameter.name} ${parameter.description ?? ""}`).join("\n")}\n */\n`;
}

function declaration(name: string, method: boolean) {
  const entry = method ? (methodTyping[name] ?? typing[name]) : typing[name];
  if (method && methodOverrides[name])
    return comment(name, entry?.parameters ?? []) + methodOverrides[name];
  if (!method && globalOverrides[name])
    return comment(name, entry?.parameters ?? []) + globalOverrides[name];
  if (!method && methodOverrides[name] && entry?.kind === "transform") {
    const signature = methodOverrides[name];
    const args = signature.slice(signature.indexOf("(") + 1, signature.lastIndexOf("):"));
    const result = signature.slice(signature.lastIndexOf("):") + 2).trim();
    const generics = signature.match(/^[\w$]+<(.+?)>\(/)?.[1];
    const typeParameters = generics ? `<T, ${generics}>` : "<T = unknown>";
    return (
      comment(name, entry.parameters) +
      `declare function ${name}${typeParameters}(${args}): (pattern: Pattern<T>) => ${result}\n` +
      `declare function ${name}${typeParameters}(${args}, pattern: Pattern<T>): ${result}`
    );
  }
  const prefix = method ? "" : "declare function ";
  if (!method && entry?.kind === "operator")
    return (
      comment(name, entry.parameters) +
      `declare function ${name}(value: PatternArgument<unknown>): <T>(pattern: PatternInput<T>) => Pattern<T>;\n` +
      `declare function ${name}<T>(value: PatternArgument<unknown>, pattern: PatternInput<T>): Pattern<T>;`
    );
  if (!method && entry?.kind === "value")
    return comment(name, []) + `declare const ${name}: ${type(entry.returns)};`;
  if (entry?.kind === "control") {
    const parameter = entry.parameters[0] ?? { name: "value", type: "unknown" };
    // Upstream JSDoc says string for these, but the runtime consumes numeric
    // mix/speed values and anchor accepts MIDI pitches as well as note names.
    const controlType =
      {
        chorus: "number",
        irspeed: "number",
        irbegin: "number",
        irend: "number",
        anchor: "string | number",
      }[name] ?? parameter.type;
    return (
      comment(name, [parameter]) +
      `${prefix}${name}(${parameter.name}${method ? "?" : ""}: ${type(controlType, true)}${method ? "" : ", pattern?: Pattern<unknown>"}): Pattern<ControlMap>;`
    );
  }
  let parameters = entry?.parameters ?? [];
  if (entry?.kind === "transform") parameters = parameters.slice(0, -1);
  // An untyped API remains callable, but unknown is never presented as an
  // authoritative parameter or return type inferred from the installed source.
  const args = parameters.length
    ? parameters
        .map((parameter, index) => {
          const rest = parameter.rest || parameter.type.startsWith("...");
          const optional =
            !rest && (parameter.optional || parameters.slice(0, index).some((p) => p.optional));
          const value = type(parameter.type, entry?.kind === "transform");
          return `${rest ? "..." : ""}${/^[\w$]+$/.test(parameter.name) ? parameter.name : `argument${index + 1}`}${optional ? "?" : ""}: ${rest ? `(${value})[]` : value}`;
        })
        .join(", ")
    : entry && entry.parametersKnown !== false
      ? ""
      : "...args: unknown[]";
  const result =
    method && entry?.returns === "Pattern"
      ? "Pattern<T>"
      : entry?.kind === "transform"
        ? "Pattern<T>"
        : type(entry?.returns ?? "unknown");
  if (entry?.kind === "transform") {
    if (method) return comment(name, parameters) + `${name}(${args}): ${result};`;
    return (
      comment(name, parameters) +
      (parameters.length
        ? `declare function ${name}(${args}): <T>(pattern: Pattern<T>) => Pattern<T>;\n`
        : "") +
      `declare function ${name}<T = unknown>(${args}${args ? ", " : ""}pattern${parameters.some((p) => p.optional) ? "?" : ""}: Pattern<T> | string | number | boolean | readonly PatternInput<T>[]): Pattern<T>;`
    );
  }
  return comment(name, parameters) + `${prefix}${name}(${args}): ${result};`;
}

const signals = new Set([
  "sine",
  "sine2",
  "cosine",
  "cosine2",
  "saw",
  "saw2",
  "square",
  "square2",
  "tri",
  "tri2",
  "rand",
  "rand2",
  "perlin",
  "isaw",
  "isaw2",
  "itri",
  "itri2",
  "time",
  "berlin",
  "mousex",
  "mousey",
  "mouseX",
  "mouseY",
  "cyclesPer",
  "per",
  "perCycle",
  "perx",
]);

/** The same declarations as editor IntelliSense, bounded to a referenced symbol. */
export function strudelTypeReference(name: string) {
  if (!api.names.includes(name) && !api.methods.includes(name)) return null;
  const withoutComments = (value: string) => value.replace(/\/\*\*[\s\S]*?\*\//g, "").trim();
  return {
    global: api.names.includes(name)
      ? signals.has(name)
        ? `declare const ${name}: Pattern<number>;`
        : withoutComments(declaration(name, false))
      : null,
    method: api.methods.includes(name) ? withoutComments(declaration(name, true)) : null,
  };
}
export const strudelTypes = [
  foundation,
  "interface Pattern<T = unknown> {",
  "readonly _Pattern: true;",
  ...[...new Set([...api.methods, ...Object.keys(methodOverrides)])].map((name) =>
    declaration(name, true),
  ),
  "}",
  "interface String {",
  ...[...new Set([...api.methods, ...Object.keys(methodOverrides)])]
    .filter((name) => !["constructor", "toString", "valueOf"].includes(name))
    .map((name) =>
      ["withValue", "fmap"].includes(name)
        ? `${name}<Text extends string, U>(this: Text, transform: (value: MiniNotationValue<Text>) => U): Pattern<U>;`
        : declaration(name, true).replace(/\bT\b/g, "unknown"),
    ),
  "}",
  ...api.names
    .filter((name) => !["in", "var", "super", "default"].includes(name))
    .map((name) =>
      signals.has(name)
        ? `declare const ${name}: Pattern<number>;`
        : name === "brand"
          ? "declare const brand: Pattern<boolean>;"
          : name === "silence"
            ? "declare const silence: Pattern<never>;"
            : declaration(name, false),
    ),
].join("\n");
