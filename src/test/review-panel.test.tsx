import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewPanel } from "@/components/jam/InlinePanel";
import { REVIEW_EXAMPLES, type ReviewKind } from "@/components/jam/review-fixtures";

afterEach(cleanup);

describe("Presentation-only reviews", () => {
  it("switches fixtures without mounting more than one active review", () => {
    const onClose = vi.fn();
    const view = render(<ReviewPanel review={REVIEW_EXAMPLES.repo} onClose={onClose} />);
    for (const kind of ["repo", "take", "rework"] as ReviewKind[]) {
      view.rerender(<ReviewPanel review={REVIEW_EXAMPLES[kind]} onClose={onClose} />);
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: REVIEW_EXAMPLES[kind].title }));
      expect(screen.getAllByRole("region", { name: REVIEW_EXAMPLES[kind].title })).toHaveLength(1);
    }
  });

  it("never provides an enabled apply action for fixture proposals", () => {
    render(<ReviewPanel review={REVIEW_EXAMPLES.rework} onClose={vi.fn()} />);
    const accept = screen.getByRole("button", { name: "Accept change, unavailable in this example" });
    expect(accept).toBeDisabled();
    fireEvent.click(accept);
    expect(accept).toBeDisabled();
  });

  it("provides only relevant dismissal actions", () => {
    const onClose = vi.fn();
    const view = render(<ReviewPanel review={REVIEW_EXAMPLES.repo} onClose={onClose} />);
    expect(screen.queryByRole("button", { name: /Accept change/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(<ReviewPanel review={REVIEW_EXAMPLES.take} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close comparison" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    view.rerender(<ReviewPanel review={REVIEW_EXAMPLES.rework} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("lets a topmost transient consume Escape before dismissing the review", () => {
    const onClose = vi.fn();
    render(<ReviewPanel review={REVIEW_EXAMPLES.repo} onClose={onClose} />);
    const transient = document.createElement("div");
    transient.setAttribute("data-review-transient", "");
    transient.setAttribute("data-state", "open");
    document.body.append(transient);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    transient.remove();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});