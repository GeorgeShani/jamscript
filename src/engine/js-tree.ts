import { javascriptLanguage } from "@codemirror/lang-javascript";

type JsTree = ReturnType<typeof javascriptLanguage.parser.parse>;

/**
 * Remembers the last few results of a pure function of the source text. A keystroke or knob
 * move used to re-parse and re-derive the same document in each of the editor, tempo,
 * mixer, problems and playback code; now they share one result. Results are immutable by
 * convention and keep their identity, so React state comparisons stay cheap.
 */
export function memoizeBySource<T>(compute: (source: string) => T, size = 6) {
  const cache = new Map<string, T>();
  return (source: string): T => {
    const hit = cache.get(source);
    if (hit !== undefined) {
      cache.delete(source);
      cache.set(source, hit);
      return hit;
    }
    const value = compute(source);
    cache.set(source, value);
    if (cache.size > size) cache.delete(cache.keys().next().value as string);
    return value;
  };
}

/** Parse with the JavaScript grammar once per distinct source text. */
export const parseJs: (source: string) => JsTree = memoizeBySource((source) =>
  javascriptLanguage.parser.parse(source),
);
