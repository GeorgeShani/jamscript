import { javascriptLanguage } from "@codemirror/lang-javascript";

export interface SyntaxProblem {
  from: number;
  to: number;
  line: number;
  column: number;
  message: string;
}

/** Parse only. Never evaluate user music or infer errors from unsupported expressions. */
export function syntaxProblems(source: string): SyntaxProblem[] {
  const tree = javascriptLanguage.parser.parse(source);
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
