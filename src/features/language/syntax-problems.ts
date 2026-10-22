import { javascriptLanguage } from "@codemirror/lang-javascript";
import { memoizeBySource, parseJs } from "@/engine/js-tree";

export interface SyntaxProblem {
  from: number;
  to: number;
  line: number;
  column: number;
  message: string;
}

/** Parse only. Never evaluate user music or infer errors from unsupported expressions. */
function syntaxProblemsUncached(source: string): SyntaxProblem[] {
  const tree = parseJs(source);
  const problems: SyntaxProblem[] = [];
  tree.iterate({
    enter(node) {
      if (!node.type.isError || problems.length >= 100) return;
      const before = source.slice(0, node.from);
      const line = before.split("\n").length;
      const lastBreak = before.lastIndexOf("\n");
      const column = node.from - lastBreak;
      problems.push({
        from: node.from,
        to: node.to,
        line,
        column,
        message:
          node.from === node.to ? "Incomplete JavaScript syntax" : "Invalid JavaScript syntax",
      });
    },
  });
  return problems;
}

export const syntaxProblems: (source: string) => SyntaxProblem[] =
  memoizeBySource(syntaxProblemsUncached);
