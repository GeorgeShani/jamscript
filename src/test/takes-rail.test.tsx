import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TakesRail } from "@/components/jam/TakesRail";
import { TAKE_FIXTURES, EXAMPLE_TAKES, TAKE_COMPARISONS } from "@/components/jam/take-fixtures";
import { EditorSlot } from "@/components/jam/EditorSlot";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SAMPLE_CODE } from "@/components/jam/session";

afterEach(cleanup);
const chip = (time: string) => screen.getByRole("button", { name: new RegExp(`Example Take ${time},`) });

describe("Presentation-only Takes", () => {
  it("keeps the current 19:44 example independent of selection and source", () => {
    const { container } = render(<TooltipProvider><EditorSlot /><TakesRail onCompare={vi.fn()} /></TooltipProvider>);
    for (const time of ["19:42", "19:43", "19:44"]) {
      fireEvent.click(chip(time));
      expect(chip(time)).toHaveAttribute("aria-pressed", "true");
      expect(chip("19:44")).toHaveAttribute("aria-current", "true");
      expect(chip("19:42")).not.toHaveAttribute("aria-current");
      expect(chip("19:43")).not.toHaveAttribute("aria-current");
      expect(screen.getAllByRole("button", { pressed: true }).filter((button) => button.hasAttribute("data-take-id"))).toHaveLength(1);
      expect([...container.querySelectorAll("code")].map((line) => line.textContent).join("\n")).toBe(SAMPLE_CODE);
    }
  });

  it("never enables audition or restore, and describes both persistently", () => {
    const onCompare = vi.fn();
    render(<TakesRail onCompare={onCompare} />);
    fireEvent.click(chip("19:43"));
    for (const name of ["Audition", "Restore"]) {
      const action = screen.getByRole("button", { name });
      expect(action).toBeDisabled();
      const description = action.getAttribute("aria-describedby");
      expect(description).toBeTruthy();
      expect(document.getElementById(description ?? "")).toBeVisible();
      fireEvent.click(action);
      expect(onCompare).not.toHaveBeenCalled();
      expect(chip("19:43")).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("launches only a static comparison identifying selected and current examples", () => {
    const onCompare = vi.fn();
    render(<TakesRail onCompare={onCompare} />);
    fireEvent.click(chip("19:43"));
    const compare = screen.getByRole("button", { name: "Compare" });
    fireEvent.click(compare);
    expect(onCompare).toHaveBeenCalledWith(TAKE_COMPARISONS["example-1943"], compare);
    expect(onCompare.mock.calls[0]?.[0].comparison).toEqual({ selected: "19:43, hats 4 to 8", current: "19:44, bass lpf 1200 to 430" });
    expect(chip("19:43")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip("19:44"));
    fireEvent.click(compare);
    expect(onCompare.mock.calls[1]?.[0].lines).toEqual([]);
  });

  it("does not scroll again on unrelated renders", () => {
    const view = render(<TakesRail onCompare={vi.fn()} />);
    const list = screen.getByRole("group", { name: "Example Take list" });
    const scrollBy = vi.fn();
    Object.defineProperty(list, "scrollBy", { value: scrollBy });
    fireEvent.click(chip("19:42"));
    view.rerender(<TakesRail onCompare={vi.fn()} />);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(chip("19:42")).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["empty", "loading", "unavailable"] as const)("keeps the %s fixture free of generated history", (status) => {
    const view = render(<TakesRail fixture={TAKE_FIXTURES[status]} onCompare={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Example Take/ })).toBeNull();
    view.rerender(<TakesRail fixture={TAKE_FIXTURES[status]} onCompare={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Compare|Audition|Restore/ })).toBeNull();
  });

  it("exposes auditioning only through its explicit fixture prop with disconnected actions", () => {
    const onCompare = vi.fn();
    const view = render(<TakesRail onCompare={onCompare} />);
    fireEvent.click(chip("19:43"));
    fireEvent.click(screen.getByRole("button", { name: "Audition" }));
    expect(screen.queryByRole("button", { name: "Back to live" })).toBeNull();
    view.rerender(<TakesRail fixture={TAKE_FIXTURES.auditioning} onCompare={onCompare} />);
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back to live" })).toBeDisabled();
    expect(onCompare).not.toHaveBeenCalled();
  });

  it("retains the same three synthetic examples in chronological order across renders", () => {
    expect(EXAMPLE_TAKES.map((take) => take.time)).toEqual(["19:42", "19:43", "19:44"]);
    const view = render(<TakesRail onCompare={vi.fn()} />);
    view.rerender(<TakesRail onCompare={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /Example Take/ })).toHaveLength(3);
  });
});