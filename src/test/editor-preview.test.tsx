import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSlot } from "@/components/jam/EditorSlot";
import { SAMPLE_CODE } from "@/components/jam/session";

afterEach(cleanup);
const source = (container: HTMLElement) =>
  [...container.querySelectorAll(".cm-line")].map((line) => line.textContent).join("\n");

describe("Editable code and live controls", () => {
  it("starts with editable source without stealing focus", () => {
    const { container } = render(<EditorSlot />);
    expect(screen.getByRole("textbox", { name: "Music code" })).toHaveAttribute(
      "contenteditable",
      "true",
    );
    expect(source(container)).toBe(SAMPLE_CODE);
    expect(document.activeElement).toBe(document.body);
  });
  it("a rhythm cell changes the source and notifies playback with that same source", () => {
    const changed = vi.fn();
    const { container } = render(<EditorSlot onChange={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "drums, step 2, rest" }));
    const expected = SAMPLE_CODE.replace("bd ~ sd ~", "bd bd sd ~");
    expect(source(container)).toBe(expected);
    expect(changed).toHaveBeenLastCalledWith(expected, expect.objectContaining({ valid: true }));
    expect(screen.getByRole("button", { name: "drums, step 2, bd" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("keyboard knob changes update the code, value and exact linked range together", () => {
    const { container } = render(<EditorSlot />);
    const knob = screen.getByRole("slider", { name: "bass lpf" });
    fireEvent.focusIn(knob);
    fireEvent.keyDown(knob, { key: "ArrowUp", shiftKey: true });
    expect(source(container)).toBe(SAMPLE_CODE.replace(".lpf(1200)", ".lpf(1300)"));
    expect(knob).toHaveAttribute("aria-valuenow", "1300");
    expect(container.querySelector(".cm-linked-source")?.textContent).toBe("1300");
    fireEvent.keyDown(knob, { key: "z", ctrlKey: true });
    expect(source(container)).toBe(SAMPLE_CODE);
    expect(knob).toHaveAttribute("aria-valuenow", "1200");
  });
  it("supports typing a knob value and canceling a later change", () => {
    const { container } = render(<EditorSlot />);
    fireEvent.click(screen.getByRole("button", { name: "Set bass lpf value" }));
    const field = screen.getByRole("spinbutton", { name: "bass lpf value" });
    fireEvent.change(field, { target: { value: "430" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(source(container)).toContain(".lpf(430)");
    fireEvent.click(screen.getByRole("button", { name: "Set bass lpf value" }));
    const canceled = screen.getByRole("spinbutton", { name: "bass lpf value" });
    fireEvent.change(canceled, { target: { value: "900" } });
    fireEvent.keyDown(canceled, { key: "Escape" });
    expect(source(container)).toContain(".lpf(430)");
  });
  it("keeps complex patterns editable in code with inert visual controls", () => {
    const { container } = render(<EditorSlot />);
    const locked = screen.getByLabelText("perc pattern, locked");
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(locked.querySelectorAll("button")).toHaveLength(0);
    fireEvent.click(locked);
    expect(source(container)).toBe(SAMPLE_CODE);
    expect(screen.getByRole("textbox", { name: "Music code" })).toHaveAttribute(
      "contenteditable",
      "true",
    );
  });
  it("preserves source across opening and closing an example review", () => {
    const view = render(<EditorSlot />);
    fireEvent.click(screen.getByRole("button", { name: "hats, step 1, hh" }));
    const edited = source(view.container);
    view.rerender(<EditorSlot panelOpen />);
    expect(view.container.firstChild).toHaveAttribute("inert");
    view.rerender(<EditorSlot panelOpen={false} />);
    expect(source(view.container)).toBe(edited);
  });
});
