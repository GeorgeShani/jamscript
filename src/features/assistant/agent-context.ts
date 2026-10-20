import { strudelDocumentation } from "@/features/language/strudel-docs";
import { syntaxProblems } from "@/features/language/syntax-problems";

type SourceFile = { id: string; name: string; source: string };

/** Derive bounded, parse-only context from the authorized source snapshot. */
export function agentContext(instruction: string, files: SourceFile[]) {
  const names = new Set<string>();
  for (const text of [instruction, ...files.map((file) => file.source)]) {
    for (const match of text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (names.size >= 40) break;
      names.add(match[1]!);
    }
  }
  const documentation = [...names]
    .map((name) => ({ name, reference: strudelDocumentation(name) }))
    .filter((item) => item.reference !== null)
    .slice(0, 20);
  const diagnostics = files.map((file) => ({
    documentId: file.id,
    problems: syntaxProblems(file.source)
      .slice(0, 5)
      .map(({ line, column, message }) => ({ line, column, message })),
  }));
  return { documentation, diagnostics };
}

/** No music is evaluated. Reject newly introduced parse failures in parseable files. */
export function proposalSyntaxCheck(
  files: SourceFile[],
  proposed: { documentId: string; proposedSource: string }[],
) {
  const originals = new Map(files.map((file) => [file.id, file.source]));
  return proposed.every((change) => {
    const original = originals.get(change.documentId);
    return (
      original !== undefined &&
      (syntaxProblems(original).length > 0 || syntaxProblems(change.proposedSource).length === 0)
    );
  });
}
