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
  // Offsets of each line start, built once on the first error instead of slicing and
  // splitting the whole document per error.
  let starts: number[] | null = null;
  const lineStarts = () => {
    if (!starts) {
      starts = [0];
      for (let at = source.indexOf("\n"); at !== -1; at = source.indexOf("\n", at + 1))
        starts.push(at + 1);
    }
    return starts;
  };
  tree.iterate({
    enter(node) {
      if (!node.type.isError || problems.length >= 100) return;
      const table = lineStarts();
      let low = 0;
      let high = table.length - 1;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (table[middle]! <= node.from) low = middle;
        else high = middle - 1;
      }
      const line = low + 1;
      const column = node.from - table[low]! + 1;
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
