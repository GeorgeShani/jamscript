import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listDocuments, listWorkspaces } from "@/workspaces/storage";

vi.mock("@/engine/playback", () => ({
  onError: vi.fn(),
  onHighlight: vi.fn(),
  play: vi.fn().mockResolvedValue(true),
  stop: vi.fn().mockResolvedValue(undefined),
  getOutputNode: vi.fn().mockReturnValue(null),
  setMix: vi.fn(),
}));
vi.mock("@/workbench/AuthControls", () => ({ AuthControls: () => null }));

afterEach(cleanup);

describe("track controls", () => {
  it("opens the inspector on a track that already has numeric parameters", async () => {
    render(
      <TooltipProvider>
        <SessionWorkbench />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Show inspector" }, { timeout: 5000 }),
    );
    expect(screen.getByRole("heading", { name: /HATS · PARAMETERS/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "gain" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inspect drums" }));
    expect(screen.getByRole("heading", { name: /DRUMS · PARAMETERS/i })).toBeTruthy();
    expect(screen.getByText(/Select hats, bass for gain, room, or filter controls/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inspect bass" }));
    expect(screen.getByRole("heading", { name: /BASS · PARAMETERS/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "lpf" })).toBeTruthy();
  });

  it("renames a track in the live source and saves its color and mixer level", async () => {
    render(
      <TooltipProvider>
        <SessionWorkbench />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Show inspector" }, { timeout: 5000 }),
    );
    fireEvent.change(screen.getByRole("slider", { name: "drums level" }), {
      target: { value: "65" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename drums" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New name for drums" }), {
      target: { value: "kick" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("slider", { name: "kick level" })).toHaveValue("65");
    expect(
      Array.from(document.querySelectorAll(".jam-editor-pane:not([hidden]) .cm-line"))
        .map((line) => line.textContent)
        .join("\n"),
    ).toContain("kick:");
    fireEvent.click(screen.getByRole("button", { name: "Change kick color" }));
    fireEvent.click(screen.getByRole("button", { name: "Pink for kick" }));
    expect(
      document
        .querySelector<HTMLElement>(".jam-workbench-main")
        ?.style.getPropertyValue("--jam-track-64"),
    ).toBe("var(--track-2)");
    const workspace = (await listWorkspaces())[0]!;
    await waitFor(async () => {
      const docs = await listDocuments(workspace.id);
      expect(docs[0]?.source).toContain('kick: s("bd');
      expect(docs[0]?.mix?.levels["kick"]).toBe(0.65);
      expect(docs[0]?.mix?.colors?.["64"]).toBe(2);
    });
  });
});
