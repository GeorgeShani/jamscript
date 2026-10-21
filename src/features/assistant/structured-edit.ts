import { proposalSyntaxCheck } from "./agent-context";
import { validateProposal } from "./proposal";

export const EDIT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          documentId: { type: "string" },
          source: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["documentId", "source", "explanation"],
      },
    },
  },
  required: ["summary", "files"],
} as const;

export function parseStructuredEdit(
  text: string,
  files: { id: string; name: string; source: string }[],
) {
  if (!text.trim()) throw new Error("Edit mode returned no proposal. Try again.");
  let output: unknown;
  try {
    output = JSON.parse(text);
  } catch {
    throw new Error("Edit mode returned an invalid proposal. Try again.");
  }
  const proposal = validateProposal(output, files);
  if (!proposalSyntaxCheck(files, proposal.files))
    throw new Error("Proposal introduces a syntax error. Ask the assistant to revise it.");
  return proposal;
}
