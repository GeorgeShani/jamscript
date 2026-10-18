export interface SearchableDocument {
  id: string;
  name: string;
  source: string;
}

export interface WorkspaceSearchHit {
  documentId: string;
  documentName: string;
  line: number;
  column: number;
  from: number;
  to: number;
  preview: string;
}

/** Literal, case-insensitive search over the current workspace's live document sources. */
export function searchWorkspaceDocuments(
  documents: readonly SearchableDocument[],
  query: string,
  limit = 500,
): { hits: WorkspaceSearchHit[]; truncated: boolean } {
  const needle = query.trim();
  if (!needle || limit < 1) return { hits: [], truncated: false };
  const expression = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const hits: WorkspaceSearchHit[] = [];
  for (const document of documents) {
    let lineNumber = 1;
    let lineStart = 0;
    while (lineStart <= document.source.length) {
      const breakAt = document.source.indexOf("\n", lineStart);
      const lineEnd = breakAt === -1 ? document.source.length : breakAt;
      const line = document.source.slice(lineStart, lineEnd);
      for (const match of line.matchAll(expression)) {
        const index = match.index;
        if (hits.length === limit) return { hits, truncated: true };
        hits.push({
          documentId: document.id,
          documentName: document.name,
          line: lineNumber,
          column: index + 1,
          from: lineStart + index,
          to: lineStart + index + match[0].length,
          preview: line.trim() || line,
        });
      }
      if (breakAt === -1) break;
      lineStart = breakAt + 1;
      lineNumber++;
    }
  }
  return { hits, truncated: false };
}
