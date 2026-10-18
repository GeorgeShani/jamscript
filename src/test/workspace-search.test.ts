import { expect, it } from "vitest";
import { searchWorkspaceDocuments } from "@/workbench/workspace-search";

it("finds literal matches across files with editor offsets and line locations", () => {
  const documents = [
    { id: "one", name: "drums.js", source: 's("bd")\n// bd\n' },
    { id: "two", name: "lead.js", source: 's("BD bd")' },
  ];
  const result = searchWorkspaceDocuments(documents, "bd");
  expect(result.truncated).toBe(false);
  expect(
    result.hits.map(({ documentId, line, column, from, to }) => ({
      documentId,
      line,
      column,
      from,
      to,
    })),
  ).toEqual([
    { documentId: "one", line: 1, column: 4, from: 3, to: 5 },
    { documentId: "one", line: 2, column: 4, from: 11, to: 13 },
    { documentId: "two", line: 1, column: 4, from: 3, to: 5 },
    { documentId: "two", line: 1, column: 7, from: 6, to: 8 },
  ]);
  expect(searchWorkspaceDocuments(documents, "b.").hits).toEqual([]);
  expect(searchWorkspaceDocuments(documents, "bd", 2).truncated).toBe(true);
});
