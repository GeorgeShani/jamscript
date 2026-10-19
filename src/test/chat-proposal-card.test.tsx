import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalCard } from "@/features/assistant/ProposalCard";
import type { ChangeProposal } from "@/features/assistant/proposal";

const proposal: ChangeProposal = {
  summary: "Adjust the groove",
  files: [
    {
      documentId: "drums",
      name: "drums.js",
      baseSource: 's("bd")',
      proposedSource: 's("bd sd")',
      explanation: "Add a snare",
    },
    {
      documentId: "bass",
      name: "bass.js",
      baseSource: 'note("c2")',
      proposedSource: 'note("d2")',
      explanation: "Raise the bass",
    },
  ],
};

describe("assistant proposal review", () => {
  it("keeps the remaining file actionable after applying one file", () => {
    const onApplyAll = vi.fn();
    render(
      <ProposalCard
        proposal={proposal}
        status="pending"
        appliedDocumentIds={["drums"]}
        sources={[
          { id: "drums", source: 's("bd sd")' },
          { id: "bass", source: 'note("c2")' },
        ]}
        onApplyAll={onApplyAll}
        onApplyFile={vi.fn()}
        onReject={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText("Ready to review")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Apply file" });
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply all" }));
    expect(onApplyAll).toHaveBeenCalledOnce();
  });
});
