import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SharePopover } from "@/features/collaboration/SharePopover";
import { ExampleAvatar } from "@/features/collaboration/ExampleAvatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function ShareHarness() {
  const [open, setOpen] = useState(false);
  return <SharePopover open={open} onOpenChange={setOpen} />;
}

describe("Preview sharing", () => {
  it("only writes the current page URL after Copy link, and waits for success", async () => {
    let complete: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ShareHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    const field = screen.getByRole("textbox", { name: "Preview URL" });
    expect(field).toHaveValue(window.location.href);
    expect(field).toHaveAttribute("readonly");
    expect(writeText).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(window.location.href);
    expect(toast).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copying link" })).toBeDisabled();
    complete?.();
    await waitFor(() => expect(toast).toHaveBeenCalledExactlyOnceWith("Link copied"));
  });

  it("never claims success when clipboard writes fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
    });
    render(<ShareHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeVisible());
    expect(toast).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Preview URL" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeEnabled();
  });

  it("allows manual copying when the clipboard API is missing", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<ShareHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeVisible());
    expect(toast).not.toHaveBeenCalled();
  });

  it("exposes example avatars as keyboard-focusable descriptions, not management actions", () => {
    render(
      <TooltipProvider>
        <ExampleAvatar initials="NK" ring="ring-track-6" />
        <ExampleAvatar initials="GS" ring="ring-track-5" />
      </TooltipProvider>,
    );
    for (const initials of ["NK", "GS"]) {
      const avatar = screen.getByLabelText(`Example collaborator ${initials}`);
      act(() => avatar.focus());
      expect(document.activeElement).toBe(avatar);
      expect(avatar.tagName).toBe("SPAN");
    }
    expect(screen.queryByRole("button")).toBeNull();
  });
});
