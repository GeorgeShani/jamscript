import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listDocuments, listWorkspaces } from "@/workspaces/storage";

vi.mock("@/engine/playback", () => ({
  onError: vi.fn(),
  play: vi.fn().mockResolvedValue(true),
  stop: vi.fn().mockResolvedValue(undefined),
  getOutputNode: vi.fn().mockReturnValue(null),
  setMix: vi.fn(),
}));
vi.mock("@/workbench/AuthControls", () => ({ AuthControls: () => null }));

afterEach(cleanup);

describe("browser workbench", () => {
  it("bounds sidebar resizing and supports keyboard fader-pane controls", async () => {
    render(
      <TooltipProvider>
        <SessionWorkbench />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Show files" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Show inspector" }, { timeout: 5000 }),
    );

    const files = screen.getByRole("separator", { name: "Resize Files pane" });
    const inspector = screen.getByRole("separator", { name: "Resize Inspector pane" });
    fireEvent.keyDown(files, { key: "Home" });
    expect(files).toHaveAttribute("aria-valuenow", "170");
    fireEvent.keyDown(inspector, { key: "Home" });
    expect(inspector).toHaveAttribute("aria-valuenow", "190");
    fireEvent.keyDown(files, { key: "End" });
    expect(Number(files.getAttribute("aria-valuenow"))).toBeGreaterThan(170);
    expect(Number(files.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(340);
    fireEvent.keyDown(inspector, { key: "ArrowLeft" });
    expect(Number(inspector.getAttribute("aria-valuenow"))).toBeGreaterThan(190);
    Object.defineProperty(files, "setPointerCapture", { value: vi.fn() });
    Object.defineProperty(files, "hasPointerCapture", { value: () => false });
    fireEvent.keyDown(files, { key: "Home" });
    fireEvent(files, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100 }));
    fireEvent(files, new MouseEvent("pointermove", { bubbles: true, clientX: 900 }));
    fireEvent(files, new MouseEvent("pointerup", { bubbles: true, clientX: 900 }));
    expect(Number(files.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(340);
    expect(Number(files.getAttribute("aria-valuenow"))).toBeGreaterThan(170);
    expect(
      screen
        .getByRole("button", { name: "Hide inspector" })
        .querySelector("svg.lucide-sliders-vertical"),
    ).toBeTruthy();
    const output = screen.getByRole("separator", { name: "Resize Output panel" });
    fireEvent.keyDown(output, { key: "Home" });
    expect(output).toHaveAttribute("aria-valuenow", "110");
    fireEvent.keyDown(output, { key: "ArrowUp" });
    expect(output).toHaveAttribute("aria-valuenow", "126");
    fireEvent.keyDown(output, { key: "End" });
    expect(Number(output.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(500);
    Object.defineProperty(output, "setPointerCapture", { value: vi.fn() });
    Object.defineProperty(output, "hasPointerCapture", { value: () => false });
    fireEvent(output, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientY: 200 }));
    fireEvent(output, new MouseEvent("pointermove", { bubbles: true, clientY: -500 }));
    fireEvent(output, new MouseEvent("pointerup", { bubbles: true, clientY: -500 }));
    expect(Number(output.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(500);
    expect(window.localStorage.getItem("jamscript-output-height")).toBe(
      output.getAttribute("aria-valuenow"),
    );
  });

  it("keeps per-document editor and undo state when switching tabs and autosaves changes", async () => {
    render(
      <TooltipProvider>
        <SessionWorkbench />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    const tempo = await screen.findByRole("spinbutton", { name: "Tempo in BPM" });
    await waitFor(() => expect(tempo).toHaveValue(144));
    const workspaceName = "Night bus";
    const workspace = (await listWorkspaces()).find((item) => item.name === workspaceName);
    expect(workspace).toBeDefined();

    fireEvent.change(tempo, { target: { value: "120" } });
    fireEvent.keyDown(tempo, { key: "Enter" });
    expect(document.querySelector(".jam-editor-pane:not([hidden]) .cm-line")?.textContent).toBe(
      "setcps(0.5);",
    );
    fireEvent.click(screen.getByRole("button", { name: "Show files" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New document name" }), {
      target: { value: "second" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create document" }));
    await screen.findByRole("tab", { name: "second.js" });
    expect(screen.getByRole("tab", { name: "second.js" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "night-bus.js" }));
    expect(document.querySelector(".jam-editor-pane:not([hidden]) .cm-line")?.textContent).toBe(
      "setcps(0.5);",
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Music code" }), {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
    });
    expect(document.querySelector(".jam-editor-pane:not([hidden]) .cm-line")?.textContent).toBe(
      "setcps(0.6);",
    );
    await waitFor(() => expect(screen.getByText("Saved locally")).toBeInTheDocument());
    await waitFor(async () => {
      const docs = await listDocuments(workspace!.id);
      expect(docs.find((item) => item.name === "night-bus.js")?.source).toContain("setcps(0.6)");
      expect(docs.some((item) => item.name === "second.js")).toBe(true);
    });
  });
});
