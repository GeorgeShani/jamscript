import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorSlot } from "@/components/jam/EditorSlot";
import { SAMPLE_CODE, LENS_SPANS, type LensKey } from "@/components/jam/session";

afterEach(cleanup);

function mountEditor() {
  return render(<TooltipProvider><EditorSlot /></TooltipProvider>);
}

describe("Presentation-only first use", () => {
  it("does not steal initial focus", () => {
    mountEditor();
    expect(document.activeElement).toBe(document.body);
  });

  it("dismisses guidance for this mount without disabling previews", () => {
    const first = mountEditor();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    const step = screen.getByRole("button", { name: "drums, step 1, bd" });
    fireEvent.click(step);
    expect(step).toHaveAttribute("aria-pressed", "false");
    first.unmount();
    mountEditor();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeEnabled();
  });

  it("changes a keyboard knob preview without rewriting the sample song", () => {
    const { container } = mountEditor();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    const lpf = screen.getByRole("slider", { name: "bass lpf" });
    fireEvent.keyDown(lpf, { key: "ArrowRight" });
    expect(lpf).toHaveAttribute("aria-valuenow", "1210");
    expect([...container.querySelectorAll("code")].map((line) => line.textContent).join("\n")).toBe(SAMPLE_CODE);
    expect(lpf.getAttribute("aria-describedby")).toBeTruthy();
  });
});

const mappings: { id: LensKey; role: "button" | "slider" | "group"; name: string; token: string }[] = [
  { id: "drums-rhythm", role: "button", name: "drums, step 3, sd", token: '"bd ~ sd ~ bd bd sd ~"' },
  { id: "hats-rhythm", role: "button", name: "hats, step 1, hh", token: '"hh hh hh hh"' },
  { id: "hats-gain", role: "slider", name: "hats gain", token: "0.6" },
  { id: "bass-lpf", role: "slider", name: "bass lpf", token: "1200" },
  { id: "bass-room", role: "slider", name: "bass room", token: "0.2" },
  { id: "perc-rhythm", role: "group", name: "perc pattern, locked", token: '"<[bd bd] ~ [sd <cp rim>]*2>"' },
];

function activeTokens(container: HTMLElement) {
  return [...container.querySelectorAll("[data-code-lens]")].filter((token) => token.classList.contains("bg-link/25"));
}

describe("Sample-only lens relationships", () => {
  for (const mapping of mappings) {
    it(`${mapping.id} focuses and hovers only its literal mapped token`, () => {
      const { container } = mountEditor();
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      const span = LENS_SPANS[mapping.id];
      expect(SAMPLE_CODE.split("\n")[span.line - 1]?.slice(span.start, span.end)).toBe(mapping.token);
      const control = screen.getByRole(mapping.role, { name: mapping.name });
      fireEvent.focus(control);
      expect(activeTokens(container).map((token) => token.textContent)).toEqual([mapping.token]);
      const lens = container.querySelector(`[data-lens="${mapping.id}"]`);
      expect(lens?.classList.contains("ring-link")).toBe(true);
      fireEvent.blur(control, { relatedTarget: document.body });
      expect(activeTokens(container)).toHaveLength(0);
      const token = container.querySelector(`[data-code-lens="${mapping.id}"]`);
      if (!token) throw new Error("Missing mapped token");
      fireEvent.mouseEnter(token);
      expect(lens?.classList.contains("ring-link")).toBe(true);
      fireEvent.mouseLeave(token);
      expect(activeTokens(container)).toHaveLength(0);
      fireEvent.focus(token);
      expect(activeTokens(container).map((item) => item.textContent)).toEqual([mapping.token]);
      fireEvent.blur(token);
      expect(activeTokens(container)).toHaveLength(0);
    });
  }

  it("does not cross-highlight the identical tempo and hats gain numbers", () => {
    const { container } = mountEditor();
    fireEvent.focus(screen.getByRole("slider", { name: "hats gain" }));
    expect(container.querySelectorAll("code")[0]?.textContent).toBe("setcps(0.6);");
    expect(container.querySelectorAll("code")[0]?.querySelector(".bg-link\\/25")).toBeNull();
    expect(activeTokens(container)).toHaveLength(1);
    expect(activeTokens(container)[0]).toHaveAttribute("data-code-lens", "hats-gain");
  });

  it("keeps a focused relationship when the pointer exits", () => {
    const { container } = mountEditor();
    const gain = screen.getByRole("slider", { name: "hats gain" });
    const lens = gain.closest("[data-lens]");
    if (!lens) throw new Error("Missing lens");
    fireEvent.focus(gain);
    fireEvent.mouseEnter(lens);
    fireEvent.mouseLeave(lens);
    expect(activeTokens(container)[0]).toHaveAttribute("data-code-lens", "hats-gain");
    fireEvent.blur(gain);
    expect(activeTokens(container)).toHaveLength(0);
  });

  it("clears obsolete relationships when an inline panel opens and closes", () => {
    const { container, rerender } = mountEditor();
    fireEvent.focus(screen.getByRole("slider", { name: "bass room" }));
    expect(activeTokens(container)).toHaveLength(1);
    rerender(<TooltipProvider><EditorSlot panelOpen /></TooltipProvider>);
    expect(activeTokens(container)).toHaveLength(0);
    rerender(<TooltipProvider><EditorSlot panelOpen={false} /></TooltipProvider>);
    expect(activeTokens(container)).toHaveLength(0);
  });

  it("never enables or toggles the locked perc cells and always exposes the safety reason", () => {
    const { container } = mountEditor();
    const lock = screen.getByRole("group", { name: "perc pattern, locked" });
    const before = lock.innerHTML;
    fireEvent.focus(lock);
    fireEvent.keyDown(lock, { key: " " });
    fireEvent.keyDown(lock, { key: "Enter" });
    fireEvent.click(lock);
    expect(lock).toHaveAttribute("aria-disabled", "true");
    expect(lock.querySelectorAll("button, [role=button]")).toHaveLength(0);
    expect(lock.innerHTML).toBe(before);
    const descriptions = lock.getAttribute("aria-describedby")?.split(" ").map((id) => document.getElementById(id)?.textContent).join(" ");
    expect(descriptions).toContain("This pattern is outside what a lens can change safely.");
    expect([...container.querySelectorAll("code")].map((line) => line.textContent).join("\n")).toBe(SAMPLE_CODE);
  });

  it("keeps all parameter previews and rhythm toggles separate from the source fixture", () => {
    const { container } = mountEditor();
    for (const name of ["hats gain", "bass lpf", "bass room"]) {
      const slider = screen.getByRole("slider", { name });
      const before = slider.getAttribute("aria-valuenow");
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      expect(slider.getAttribute("aria-valuenow")).not.toBe(before);
      expect(slider.getAttribute("aria-valuetext")).toContain("control preview");
    }
    const rest = screen.getByRole("button", { name: "drums, step 2, rest" });
    fireEvent.click(rest);
    expect(rest).toHaveAttribute("aria-pressed", "true");
    expect(rest).toHaveAccessibleName("drums, step 2, bd");
    expect([...container.querySelectorAll("code")].map((line) => line.textContent).join("\n")).toBe(SAMPLE_CODE);
  });

  it.each([
    { name: "hats gain", initial: 0.6, step: 0.01, min: 0, max: 1 },
    { name: "bass lpf", initial: 1200, step: 10, min: 50, max: 20000 },
    { name: "bass room", initial: 0.2, step: 0.01, min: 0, max: 1 },
  ])("steps and clamps the $name preview without editing code", ({ name, initial, step, min, max }) => {
    const { container } = mountEditor();
    const slider = screen.getByRole("slider", { name });
    fireEvent.keyDown(slider, { key: "ArrowUp", shiftKey: true });
    expect(Number(slider.getAttribute("aria-valuenow"))).toBeCloseTo(initial + step * 10);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(Number(slider.getAttribute("aria-valuenow"))).toBeCloseTo(initial + step * 9);
    fireEvent.keyDown(slider, { key: "End" });
    fireEvent.keyDown(slider, { key: "ArrowRight", shiftKey: true });
    expect(Number(slider.getAttribute("aria-valuenow"))).toBe(max);
    fireEvent.keyDown(slider, { key: "Home" });
    fireEvent.keyDown(slider, { key: "ArrowDown", shiftKey: true });
    expect(Number(slider.getAttribute("aria-valuenow"))).toBe(min);
    expect([...container.querySelectorAll("code")].map((line) => line.textContent).join("\n")).toBe(SAMPLE_CODE);
  });
});