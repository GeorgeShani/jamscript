import api from "./strudel-api.generated.json";
import { docs } from "./strudel-docs";

type Parameter = {
  name: string;
  type: string;
  optional?: boolean;
  rest?: boolean;
  description?: string;
};
type Typing = { kind: string; parameters: Parameter[]; returns: string };
const typing: Record<string, Typing> = api.typing;

// Pattern inputs deliberately include mini-notation. A numeric control's string
// notation is evaluated by Strudel, not JavaScript's number parser.
const foundation = `
type PatternInput<T = unknown> = T | string | Pattern<T> | readonly PatternInput<T>[];
type PatternTransform<T = unknown> = (pattern: Pattern<T>) => Pattern<T>;
interface ControlMap { s?: string; n?: number; note?: string | number; gain?: number; pan?: number; lpf?: number; room?: number; [control: string]: unknown }
interface Fraction { valueOf(): number; toString(): string; add(value: number | Fraction): Fraction; sub(value: number | Fraction): Fraction; mul(value: number | Fraction): Fraction; div(value: number | Fraction): Fraction; }
interface TimeSpan { begin: Fraction; end: Fraction; readonly duration: Fraction; readonly spanCycles: TimeSpan[]; withTime(transform: (time: Fraction) => number | Fraction): TimeSpan; }
interface Hap<T = unknown> { whole: TimeSpan | undefined; part: TimeSpan; value: T; context: { locations?: { start: number; end: number }[]; [key: string]: unknown }; stateful: boolean; readonly duration: Fraction; wholeOrPart(): TimeSpan; withValue<U>(transform: (value: T) => U): Hap<U>; }
interface QueryState { span: TimeSpan; controls: ControlMap; }
type SampleBank = string | readonly string[] | { [note: string]: string | readonly string[] };
interface SampleMap { _base?: string; [sound: string]: SampleBank | undefined; }
interface SampleOptions { prebake?: boolean; tag?: string; }
`;

const methodOverrides: Record<string, string> = {
  withValue: "withValue<U>(transform: (value: T) => U): Pattern<U>;",
  fmap: "fmap<U>(transform: (value: T) => U): Pattern<U>;",
  filterValues: "filterValues(predicate: (value: T) => boolean): Pattern<T>;",
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
    "sometimesBy(probability: PatternInput<number>, transform: PatternTransform<T>): Pattern<T>;",
  every: "every(cycles: PatternInput<number>, transform: PatternTransform<T>): Pattern<T>;",
  chunk: "chunk(count: PatternInput<number>, transform: PatternTransform<T>): Pattern<T>;",
  off: "off(time: PatternInput<number>, transform: PatternTransform<T>): Pattern<T>;",
  jux: "jux(transform: PatternTransform<T>): Pattern<T>;",
  set: "set<U>(other: PatternInput<U>): Pattern<T & U>;",
  range: "range(min: PatternInput<number>, max: PatternInput<number>): Pattern<number>;",
  rangex: "rangex(min: PatternInput<number>, max: PatternInput<number>): Pattern<number>;",
  range2: "range2(min: PatternInput<number>, max: PatternInput<number>): Pattern<number>;",
  ply: "ply(factor: PatternInput<number>): Pattern<T>;",
  struct: "struct(...structure: PatternInput<unknown>[]): Pattern<T>;",
  mask: "mask(...mask: PatternInput<unknown>[]): Pattern<T>;",
};
for (const name of ["add", "sub", "mul", "div", "mod", "pow"])
  methodOverrides[name] = `${name}(value: PatternInput<number>): Pattern<T>;`;
const globalOverrides: Record<string, string> = {
  // signal.mjs reifies the bound, then joins numeric random-value patterns.
  irand: "declare function irand(max: PatternInput<number>): Pattern<number>;",
  _irand: "declare function _irand(max: number): Pattern<number>;",
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
  "polyrhythm",
  "pr",
]) {
  globalOverrides[name] =
    `declare function ${name}<Values extends readonly unknown[]>(...patterns: { [Index in keyof Values]: PatternInput<Values[Index]> }): Pattern<Values[number]>;`;
  if (api.methods.includes(name))
    methodOverrides[name] =
      `${name}<Values extends readonly unknown[]>(...patterns: { [Index in keyof Values]: PatternInput<Values[Index]> }): Pattern<T | Values[number]>;`;
}

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
    ? `PatternInput<${union.filter((part) => !part.startsWith("Pattern<")).join(" | ") || "unknown"}>`
    : normalized;
}

function comment(name: string, parameters: Parameter[]) {
  const detail = docs[name]?.detail ?? "";
  return `/** ${detail.replace(/\*\//g, "")}\n${parameters.map((parameter) => ` * @param ${parameter.name} ${parameter.description ?? ""}`).join("\n")}\n */\n`;
}

function declaration(name: string, method: boolean) {
  const entry = typing[name];
  if (method && methodOverrides[name])
    return comment(name, entry?.parameters ?? []) + methodOverrides[name];
  if (!method && globalOverrides[name])
    return comment(name, entry?.parameters ?? []) + globalOverrides[name];
  if (!method && methodOverrides[name] && entry?.kind === "transform") {
    const signature = methodOverrides[name];
    const args = signature.slice(signature.indexOf("(") + 1, signature.lastIndexOf("):"));
    const result = signature.slice(signature.lastIndexOf("):") + 2).trim();
    return (
      comment(name, entry.parameters) +
      `declare function ${name}<T = unknown>(${args}): (pattern: Pattern<T>) => ${result}\n` +
      `declare function ${name}<T = unknown>(${args}, pattern: Pattern<T>): ${result}`
    );
  }
  const prefix = method ? "" : "declare function ";
  if (entry?.kind === "control") {
    const parameter = entry.parameters[0] ?? { name: "value", type: "unknown" };
    return (
      comment(name, [parameter]) +
      `${prefix}${name}(${parameter.name}${method ? "?" : ""}: ${type(parameter.type, true)}${method ? "" : ", pattern?: Pattern<unknown>"}): Pattern<ControlMap>;`
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
    : entry
      ? ""
      : "...args: unknown[]";
  const result = entry?.kind === "transform" ? "Pattern<T>" : type(entry?.returns ?? "unknown");
  if (entry?.kind === "transform") {
    if (method) return comment(name, parameters) + `${name}(${args}): ${result};`;
    return (
      comment(name, parameters) +
      (parameters.length
        ? `declare function ${name}(${args}): <T>(pattern: Pattern<T>) => Pattern<T>;\n`
        : "") +
      `declare function ${name}<T = unknown>(${args}${args ? ", " : ""}pattern${parameters.some((p) => p.optional) ? "?" : ""}: Pattern<T>): Pattern<T>;`
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
]);
export const strudelTypes = [
  foundation,
  "interface Pattern<T = unknown> {",
  "readonly _Pattern: true;",
  ...[...new Set([...api.methods, ...Object.keys(methodOverrides)])].map((name) =>
    declaration(name, true),
  ),
  "}",
  "interface String {",
  ...api.methods
    .filter((name) => !Object.getOwnPropertyNames(String.prototype).includes(name))
    .map((name) => declaration(name, true).replace(/\bT\b/g, "unknown")),
  "}",
  ...api.names
    .filter((name) => !["in", "var", "super", "default"].includes(name))
    .map((name) =>
      signals.has(name)
        ? `declare const ${name}: Pattern<number>;`
        : name === "silence"
          ? "declare const silence: Pattern<never>;"
          : declaration(name, false),
    ),
].join("\n");
