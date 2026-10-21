import { javascriptLanguage } from "@codemirror/lang-javascript";
import type { SourcePatch } from "./music-document";

/** Replace only a selected, single literal sound with no inherited bank. */
export function sampleReplacement(
  source: string,
  position: number,
  name: string,
  index: number,
): SourcePatch | null {
  if (!/^[\w-]+$/.test(name) || !Number.isInteger(index) || index < 0) return null;
  let node = javascriptLanguage.parser.parse(source).resolveInner(position, -1);
  while (node.parent && node.name !== "String") node = node.parent;
  if (node.name !== "String" || node.parent?.name !== "ArgList") return null;
  const args = node.parent,
    call = args.parent;
  const argumentsFound = [];
  for (let arg = args.firstChild; arg; arg = arg.nextSibling)
    if (!["(", ")", ",", "LineComment", "BlockComment"].includes(arg.name))
      argumentsFound.push(arg);
  if (argumentsFound.length !== 1) return null;
  if (
    call?.name !== "CallExpression" ||
    !/^(s|sound)$|\.(s|sound)$/.test(source.slice(call.from, args.from))
  )
    return null;
  if (!/^[\w:-]+$/.test(source.slice(node.from + 1, node.to - 1))) return null;
  let chain = call;
  while (chain.parent && chain.parent.name !== "Script") chain = chain.parent;
  if (/\.bank\s*\(/.test(source.slice(chain.from, chain.to))) return null;
  return { from: node.from + 1, to: node.to - 1, insert: `${name}:${index}` };
}
