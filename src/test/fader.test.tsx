import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Fader } from "@/components/ui/fader";

afterEach(cleanup);

it("uses current fader values and callbacks for focused wheel adjustments", () => {
  const before = vi.fn();
  const after = vi.fn();
  const committed = vi.fn();
  const { rerender, unmount } = render(
    <Fader aria-label="Level" allowWheel value={-10} onValueChange={before} />,
  );
  const slider = screen.getByRole("slider", { name: "Level" });
  const root = slider.closest('[data-slot="fader"]')!;
  act(() => slider.focus());
  const wheel = createEvent.wheel(root, { deltaY: -1, bubbles: true, cancelable: true });
  fireEvent(root, wheel);
  expect(wheel.defaultPrevented).toBe(true);
  expect(before).toHaveBeenCalledWith(-9.5, expect.objectContaining({ reason: "wheel" }));

  rerender(
    <Fader
      aria-label="Level"
      allowWheel
      value={-5}
      step={1}
      onValueChange={after}
      onValueCommitted={committed}
    />,
  );
  fireEvent.wheel(root, { deltaY: -1 });
  expect(after).toHaveBeenCalledWith(-4, expect.objectContaining({ reason: "wheel" }));
  expect(committed).toHaveBeenLastCalledWith(-4);
  expect(before).toHaveBeenCalledOnce();

  unmount();
  fireEvent.wheel(root, { deltaY: -1 });
  expect(after).toHaveBeenCalledOnce();
});

it("leaves wheel scrolling alone when the fader is unfocused or wheel control is off", () => {
  const change = vi.fn();
  const { rerender } = render(<Fader aria-label="Level" allowWheel onValueChange={change} />);
  const slider = screen.getByRole("slider", { name: "Level" });
  const root = slider.closest('[data-slot="fader"]')!;
  const wheel = createEvent.wheel(root, { deltaY: -1, bubbles: true, cancelable: true });
  fireEvent(root, wheel);
  expect(wheel.defaultPrevented).toBe(false);
  expect(change).not.toHaveBeenCalled();
  act(() => slider.focus());
  rerender(<Fader aria-label="Level" allowWheel={false} onValueChange={change} />);
  fireEvent.wheel(root, { deltaY: -1 });
  expect(change).not.toHaveBeenCalled();
});
