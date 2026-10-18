import { Button } from "@/components/ui/button";
import { proposalIsFresh, type ChangeProposal } from "./proposal";
import { lineDiffCounts } from "./chat-diff";
import type { ProposalStatus } from "./chat-types";

export function ProposalCard({
  proposal,
  status,
  sources,
  onApplyAll,
  onApplyFile,
  onReject,
  onReveal,
}: {
  proposal: ChangeProposal;
  status: ProposalStatus;
  sources: { id: string; source: string }[];
  onApplyAll: () => void;
  onApplyFile: (documentId: string) => void;
  onReject: () => void;
  onReveal: (documentIds: string[]) => void;
}) {
  const fresh = status === "pending" && proposalIsFresh(proposal, sources);
  const disabled = !fresh || status !== "pending";
  return (
    <div className="jam-chat-proposal" data-status={status}>
      <div className="jam-chat-proposal-header">
        <strong>{proposal.summary}</strong>
        <span className="jam-chat-proposal-status">
          {status === "applied"
            ? "Applied"
            : status === "rejected"
              ? "Rejected"
              : fresh
                ? "Ready to review"
                : "Stale"}
        </span>
      </div>
      <ul className="jam-chat-proposal-files">
        {proposal.files.map((file) => {
          const counts = lineDiffCounts(file.baseSource, file.proposedSource);
          return (
            <li key={file.documentId}>
              <div className="jam-chat-proposal-file-meta">
                <button
                  type="button"
                  className="jam-chat-proposal-file-name"
                  onClick={() => onReveal([file.documentId])}
                >
                  {file.name}
                </button>
                <span>
                  +{counts.added} / −{counts.removed}
                </span>
              </div>
              <p>{file.explanation}</p>
              <div className="jam-take-compare">
                <div>
                  <strong>Current</strong>
                  <pre>{file.baseSource}</pre>
                </div>
                <div>
                  <strong>Proposed</strong>
                  <pre>{file.proposedSource}</pre>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={disabled}
                onClick={() => onApplyFile(file.documentId)}
              >
                Apply file
              </Button>
            </li>
          );
        })}
      </ul>
      {!fresh && status === "pending" && (
        <p role="status">A file changed since this proposal. Reject it or ask again.</p>
      )}
      <div className="jam-chat-proposal-actions">
        <Button size="sm" type="button" disabled={disabled} onClick={onApplyAll}>
          Apply all
        </Button>
        <Button
          size="sm"
          variant="outline"
          type="button"
          disabled={status !== "pending"}
          onClick={onReject}
        >
          Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => onReveal(proposal.files.map((file) => file.documentId))}
        >
          Reveal in editor
        </Button>
      </div>
    </div>
  );
}
