export interface ProposalFile {
  documentId: string;
  name: string;
  baseSource: string;
  proposedSource: string;
  explanation: string;
}

export interface ChangeProposal {
  summary: string;
  files: ProposalFile[];
}

/** Model output is untrusted. Restrict changes to the exact authorized source snapshot. */
export function validateProposal(
  output: unknown,
  files: { id: string; name: string; source: string }[],
): ChangeProposal {
  if (!output || typeof output !== "object") throw new Error("Invalid agent response");
  const value = output as { summary?: unknown; files?: unknown };
  if (
    typeof value.summary !== "string" ||
    value.summary.length > 1000 ||
    !Array.isArray(value.files)
  )
    throw new Error("Invalid agent response");
  if (!value.files.length || value.files.length > files.length)
    throw new Error("Invalid proposal files");
  const allowed = new Map(files.map((file) => [file.id, file]));
  const seen = new Set<string>();
  const edits: ProposalFile[] = [];
  for (const item of value.files) {
    if (!item || typeof item !== "object") throw new Error("Invalid proposal file");
    const change = item as { documentId?: unknown; source?: unknown; explanation?: unknown };
    if (
      typeof change.documentId !== "string" ||
      typeof change.source !== "string" ||
      typeof change.explanation !== "string" ||
      change.explanation.length > 1000 ||
      change.source.length > 100_000 ||
      seen.has(change.documentId)
    )
      throw new Error("Invalid proposal file");
    const original = allowed.get(change.documentId);
    if (!original) throw new Error("Proposal references an unauthorized file");
    seen.add(change.documentId);
    if (change.source !== original.source)
      edits.push({
        documentId: original.id,
        name: original.name,
        baseSource: original.source,
        proposedSource: change.source,
        explanation: change.explanation,
      });
  }
  if (!edits.length) throw new Error("Agent proposed no changes");
  return { summary: value.summary, files: edits };
}

export function proposalIsFresh(
  proposal: ChangeProposal,
  current: { id: string; source: string }[],
) {
  const byId = new Map(current.map((file) => [file.id, file.source]));
  return proposal.files.every((file) => byId.get(file.documentId) === file.baseSource);
}
