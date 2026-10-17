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
