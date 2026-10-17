import { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReworkBar } from "@/components/jam/ReworkBar";
import { ReviewPanel } from "@/components/jam/InlinePanel";
import { REWORK_FIXTURES, REWORK_SAMPLE_REQUEST, reworkRequestKind } from "@/components/jam/rework-fixtures";
import { REVIEW_EXAMPLES, type ReviewExample } from "@/components/jam/review-fixtures";
import { SAMPLE_CODE } from "@/components/jam/session";
import { TAKE_FIXTURES } from "@/components/jam/take-fixtures";

afterEach(cleanup);
function Harness() {
  const input = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<ReviewExample | null>(null);
  return <><ReworkBar inputRef={input} onPreview={(next) => setReview(next)} />{review && <ReviewPanel review={review} onClose={() => setReview(null)} />}</>;
}
describe("Sample-only Rework", () => {
  it("rejects empty and whitespace-only input", () => {
    expect(reworkRequestKind("")).toBe("empty");
    expect(reworkRequestKind(" \n\t ")).toBe("empty");
    const onPreview = vi.fn();
    render(<ReworkBar inputRef={{ current: null }} onPreview={onPreview} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Preview proposal" })).toBeDisabled();
    const form = screen.getByRole("textbox").closest("form");
    if (!form) throw new Error("Missing Rework form");
    fireEvent.submit(form);
    expect(onPreview).not.toHaveBeenCalled();
  });
  it("only recognizes the named sample, allowing case and surrounding whitespace", () => {
    expect(reworkRequestKind(REWORK_SAMPLE_REQUEST)).toBe("sample");
    expect(reworkRequestKind("  busier hats, keep the kick  ")).toBe("sample");
    expect(reworkRequestKind("Busier hats, remove the kick")).toBe("unavailable");
  });
  it("does not open a canned answer for arbitrary requests", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Make bass quieter" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview proposal" }));
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Example proposal" })).toBeNull();
    expect(screen.getByRole("textbox")).toHaveValue("Make bass quieter");
  });
  it("selects the sample deliberately, opens only its fixed proposal, and preserves input on Discard", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: `Example request: ${REWORK_SAMPLE_REQUEST}` }));
    expect(screen.getByRole("textbox")).toHaveValue(REWORK_SAMPLE_REQUEST);
    expect(screen.queryByRole("region", { name: "Example proposal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview proposal" }));
    expect(screen.getByRole("region", { name: "Example proposal" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("region", { name: "Example proposal" })).toBeNull();
    expect(screen.getByRole("textbox")).toHaveValue(REWORK_SAMPLE_REQUEST);
  });
  it("uses literal hats-only rows and preserves source and Takes", () => {
    const source = SAMPLE_CODE;
    const takes = JSON.stringify(TAKE_FIXTURES);
    expect(REWORK_FIXTURES.normal.lines).toEqual([
      { kind: "-", text: 'hats: s("hh hh hh hh").gain(0.6);' },
      { kind: "+", text: 'hats: s("hh hh hh hh hh hh hh hh").gain(0.6);' },
    ]);
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: REWORK_SAMPLE_REQUEST } });
    fireEvent.click(screen.getByRole("button", { name: "Preview proposal" }));
    fireEvent.click(screen.getByRole("button", { name: /Accept change/ }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(SAMPLE_CODE).toBe(source);
    expect(JSON.stringify(TAKE_FIXTURES)).toBe(takes);
  });
  it.each(Object.keys(REWORK_FIXTURES) as (keyof typeof REWORK_FIXTURES)[])("never enables apply in %s check presentation", (key) => {
    const fixture = REWORK_FIXTURES[key];
    expect(fixture.checks?.map((check) => check.label)).toEqual(["Parses", "Plays", "Keeps what you asked"]);
    expect(fixture.checks?.map((check) => check.status)).toEqual(Array(3).fill(key === "normal" ? "notChecked" : key));
    const view = render(<ReviewPanel review={fixture} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Accept change/ })).toBeDisabled();
    expect(fixture.summary).toBe(REWORK_FIXTURES.normal.summary);
    // Replacing this proposal with another review must not stack either panel.
    view.rerender(<ReviewPanel review={REVIEW_EXAMPLES.repo} onClose={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "Example proposal" })).toBeNull();
    expect(screen.getAllByRole("region", { name: "Changes in night-bus.js" })).toHaveLength(1);
  });
  it("can discard a pending fixture without scheduling later state changes", () => {
    const schedule = vi.spyOn(window, "setTimeout");
    const onClose = vi.fn();
    const view = render(<ReviewPanel review={REWORK_FIXTURES.pending} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(schedule).not.toHaveBeenCalled();
    schedule.mockRestore();
  });
});