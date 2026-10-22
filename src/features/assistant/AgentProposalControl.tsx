import { useEffect, useRef, useState } from "react";
import { DismissibleDetails } from "@/components/ui/dismissible-details";
import { Button } from "@/components/ui/button";
import { proposalIsFresh, type ChangeProposal } from "./proposal";

export function AgentProposalControl({
  documentId,
  sources,
  onReveal,
  onApply,
}: {
  documentId: string;
  sources: { id: string; source: string }[];
  onReveal: (documentIds: string[]) => void;
  onApply: (proposal: ChangeProposal) => boolean;
}) {
  const [available, setAvailable] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<ChangeProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [scope, setScope] = useState<"active" | "workspace">("active");
  const pendingRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/agent-proposal")
      .then(async (response) =>
        response.ok ? (response.json() as Promise<{ available: boolean }>) : { available: false },
      )
      .then((status) => {
        if (active) setAvailable(status.available);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
      pendingRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    pendingRequest.current?.abort();
    setProposal(null);
    setError(null);
    setPending(false);
    setProgress(null);
  }, [documentId]);
  if (!available) return null;

  const propose = async () => {
    const controller = new AbortController();
    pendingRequest.current = controller;
    setPending(true);
    setError(null);
    setProposal(null);
    setProgress("Reading authorized files");
    try {
      const response = await fetch("/api/agent-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ documentId, instruction, scope }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "The proposal failed");
      }
      let body: ChangeProposal;
      if (response.headers.get("content-type")?.includes("application/x-ndjson") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let result: ChangeProposal | null = null;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline >= 0) {
            const line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            if (line) {
              const event = JSON.parse(line) as {
                type: string;
                message?: string;
                proposal?: ChangeProposal;
              };
              if (event.type === "progress" && !controller.signal.aborted)
                setProgress(event.message ?? "Generating proposal");
              if (event.type === "error") throw new Error(event.message ?? "The proposal failed");
              if (event.type === "proposal") result = event.proposal ?? null;
            }
            newline = buffer.indexOf("\n");
          }
        }
        if (!result) throw new Error("The proposal ended without a result");
        body = result;
      } else {
        body = (await response.json()) as ChangeProposal;
      }
      if (!controller.signal.aborted) {
        onReveal(body.files.map((file) => file.documentId));
        setProposal(body);
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "The proposal failed");
    } finally {
      if (pendingRequest.current === controller) {
        pendingRequest.current = null;
        setPending(false);
        setProgress(null);
      }
    }
  };
  const fresh = proposal && proposalIsFresh(proposal, sources);
  return (
    <DismissibleDetails className="jam-agent-control">
      <summary>Ask Gemini</summary>
      <div className="jam-agent-popup">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void propose();
          }}
        >
          <label htmlFor="jam-agent-instruction">Describe a change</label>
          <textarea
            id="jam-agent-instruction"
            value={instruction}
            maxLength={1000}
            onChange={(event) => setInstruction(event.target.value)}
          />
          <label htmlFor="jam-agent-scope">Files to consider</label>
          <select
            id="jam-agent-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as "active" | "workspace")}
          >
            <option value="active">Current file</option>
            <option value="workspace">Shared workspace (up to 8 files)</option>
          </select>
          <div className="jam-agent-actions">
            <Button
              size="sm"
              variant="outline"
              type="submit"
              disabled={pending || instruction.trim().length < 3}
            >
              Propose change
            </Button>
            {pending && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => {
                  pendingRequest.current?.abort();
                  setPending(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
        {error && <p role="alert">{error}</p>}
        {pending && progress && <p role="status">{progress}</p>}
        {proposal && (
          <div className="jam-agent-review">
            <strong>{proposal.summary}</strong>
            {proposal.files.map((file) => (
              <details key={file.documentId}>
                <summary>
                  {file.name}: {file.explanation}
                </summary>
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
              </details>
            ))}
            {!fresh && (
              <p role="status">
                A file changed since this proposal was generated. Request a new proposal.
              </p>
            )}
            <Button
              size="sm"
              type="button"
              disabled={!fresh}
              onClick={() => {
                if (onApply(proposal)) setProposal(null);
                else setError("The editor changed. Request a new proposal.");
              }}
            >
              Apply reviewed {proposal.files.length === 1 ? "change" : "changes"}
            </Button>
          </div>
        )}
      </div>
    </DismissibleDetails>
  );
}
