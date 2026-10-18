import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationPage } from "../presentation/PresentationPage";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("stage presentation", () => {
  it("navigates with common clicker keys and opens speaker notes", async () => {
    window.history.replaceState(null, "", "/presentation");
    render(<PresentationPage />);

    expect(screen.getByRole("heading", { name: /the beat is good/i })).toBeTruthy();
    const nestedBeatLine = screen.getByText(/bd ~ sd ~ bd bd sd ~/).closest("code");
    expect(nestedBeatLine?.style.paddingInlineStart).toBe("2ch");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(window.location.hash).toBe("#slide-2"));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /what if you could/i })).toBeTruthy(),
    );

    fireEvent.keyDown(window, { key: "n" });
    expect(screen.getByLabelText("Speaker notes")).toBeTruthy();
    fireEvent.keyDown(window, { key: "PageDown" });
    await waitFor(() => expect(window.location.hash).toBe("#slide-3"));
    fireEvent.keyDown(window, { key: "Home" });
    await waitFor(() => expect(window.location.hash).toBe("#slide-1"));
  });

  it("uses F for fullscreen and B for blackout", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    HTMLElement.prototype.requestFullscreen = requestFullscreen;
    render(<PresentationPage />);

    fireEvent.keyDown(window, { key: "f" });
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledOnce());
    fireEvent.keyDown(window, { key: "b" });
    expect(screen.getByRole("button", { name: "Resume presentation" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "b" });
    expect(screen.queryByRole("button", { name: "Resume presentation" })).toBeNull();
  });
});
