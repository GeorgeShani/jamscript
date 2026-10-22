import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { dispatchLensEdit, musicModel } from "@/components/jam/code-editor";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  browserStorage,
  createDocument,
  createWorkspace,
  listDocuments,
  listWorkspaces,
  saveDocument,
} from "@/workspaces/storage";
import * as playback from "@/engine/playback";

vi.mock("@/engine/playback", () => ({
  warmPlayback: vi.fn().mockResolvedValue(undefined),
  onError: vi.fn(),
  onAsset: vi.fn(),
  onHighlight: vi.fn(),
  play: vi.fn().mockResolvedValue(true),
  stop: vi.fn().mockResolvedValue(undefined),
  getOutputNode: vi.fn().mockReturnValue(null),
  outputFrames: vi.fn().mockReturnValue(null),
  setMix: vi.fn(),
}));
vi.mock("@/workbench/AuthControls", () => ({
  AuthControls: () => null,
  GuestWorkspaceNotice: () => null,
}));

afterEach(cleanup);

describe("browser workbench", () => {
  it("streams component edits during playback and applies typed code only with Ctrl+Enter", async () => {
    const { workspace } = await createWorkspace(
      `Live ${crypto.randomUUID()}`,
      'drums: s("bd").gain(0.5);',
    );
    const { container } = render(
      <TooltipProvider>
        <SessionWorkbench workspaceId={workspace.id} />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /^Play$/ }));
    await screen.findByRole("button", { name: /^Stop$/ });
    vi.mocked(playback.play).mockClear();
    const view = EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!;
    const start = view.state.doc.toString().indexOf("0.5");
    act(() => view.dispatch({ changes: { from: start, to: start + 3, insert: "0.3" } }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 220));
    });
    expect(playback.play).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Music code" }), {
      key: "Enter",
      ctrlKey: true,
    });
    await waitFor(() => expect(playback.play).toHaveBeenCalledWith('drums: s("bd").gain(0.3);'));
    vi.mocked(playback.play).mockClear();
    const lens = view.state
      .field(musicModel)
      .tracks[0]!.lenses.find((lens) => lens.kind === "param")!;
    act(() => {
      expect(dispatchLensEdit(view, { target: lens.id, value: 0.7 })).toBe(true);
    });
    expect(view.state.doc.toString()).toBe('drums: s("bd").gain(0.7);');
    await waitFor(() => expect(playback.play).toHaveBeenCalledWith('drums: s("bd").gain(0.7);'));
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/ }));
  });

  it("uses an in-app Save As dialog for desktop folders", async () => {
    const { workspace } = await createWorkspace(`Desktop ${crypto.randomUUID()}`, 's("bd")');
    const saveAs = vi.fn(
      async (document: Awaited<ReturnType<typeof createDocument>>, name: string) => ({
        ...document,
        id: crypto.randomUUID(),
        name,
      }),
    );
    render(
      <TooltipProvider>
        <SessionWorkbench
          workspaceId={workspace.id}
          storage={{
            ...browserStorage,
            isNativeWorkspace: (id) => id === workspace.id,
            isDirty: () => true,
            saveToDisk: async () => {},
            saveAs,
          }}
        />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Save As" }));
    const dialog = screen.getByRole("dialog", { name: "Save a copy" });
    expect(dialog).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "File name" }), {
      target: { value: "copy.js" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save copy" }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledWith(expect.anything(), "copy.js"));
    await waitFor(() =>
      expect(document.querySelector(".jam-current-file")).toHaveTextContent("copy.js"),
    );
    expect(screen.queryByRole("dialog", { name: "Save a copy" })).not.toBeInTheDocument();
  });

  it("searches file contents across the workspace and opens a selected result", async () => {
    const { workspace } = await createWorkspace(`Search ${crypto.randomUUID()}`, 's("bd")');
    const second = await createDocument(workspace.id, "lead.js");
    await saveDocument({ ...second, source: 's("bd hh")' });
    render(
      <TooltipProvider>
        <SessionWorkbench workspaceId={workspace.id} />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Search workspace" }));
    const query = screen.getByRole("searchbox", { name: "Search in workspace files" });
    fireEvent.change(query, { target: { value: "bd" } });
    expect(screen.getByText("2 results in workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /lead\.js, line 1, column 4/ }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "lead.js" })).toHaveAttribute("aria-selected", "true"),
    );
    expect(screen.queryByText("replace all")).not.toBeInTheDocument();
  });

  it("starts a blank document with editable Strudel code", async () => {
    const { workspace } = await createWorkspace(`Starter ${crypto.randomUUID()}`);
    const { container } = render(
      <TooltipProvider>
        <SessionWorkbench workspaceId={workspace.id} />
      </TooltipProvider>,
    );
    const insert = await screen.findByRole("button", { name: "Insert a beat" });
    await waitFor(() => expect(insert).toBeEnabled());
    fireEvent.click(insert);
    await waitFor(() =>
      expect(container.querySelector(".cm-content")?.textContent).toContain(
        'drums: s("bd ~ sd ~")',
      ),
    );
    expect(screen.queryByText("Your song starts here.")).not.toBeInTheDocument();
  });

  it("opens files and commands from one keyboard driven palette", async () => {
    render(
      <TooltipProvider>
        <SessionWorkbench />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    await screen.findByRole("tab", { name: "night-bus.js" });
    fireEvent.click(screen.getByRole("button", { name: "Show files" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New document name" }), {
      target: { value: "second" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create document" }));
    // Creation commits an IndexedDB transaction before React opens the editor.
    await screen.findByRole("tab", { name: "second.js" }, { timeout: 5000 });

    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const search = screen.getByRole("combobox", { name: "Find a file" });
    fireEvent.change(search, { target: { value: "night" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByRole("tab", { name: "night-bus.js" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(window, { key: "P", ctrlKey: true, shiftKey: true });
    const command = screen.getByRole("combobox", { name: "Find a command" });
    fireEvent.change(command, { target: { value: "Hide Output" } });
    fireEvent.keyDown(command, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Show output" })).toBeInTheDocument();
  });

  it("reopens a workspace from its URL identity and reports a missing local workspace", async () => {
    const route = vi.fn();
    const rendered = render(
      <TooltipProvider>
        <SessionWorkbench onWorkspaceRoute={route} />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    const workspace = (await listWorkspaces()).find((item) => item.name === "Night bus");
    expect(workspace).toBeDefined();
    await waitFor(() => expect(route).toHaveBeenCalledWith(workspace!.id));
    rendered.rerender(
      <TooltipProvider>
        <SessionWorkbench workspaceId={workspace!.id} onWorkspaceRoute={route} />
      </TooltipProvider>,
    );
    expect(await screen.findByRole("tab", { name: "night-bus.js" })).toBeInTheDocument();
    rendered.rerender(
      <TooltipProvider>
        <SessionWorkbench workspaceId="missing-local-workspace" onWorkspaceRoute={route} />
      </TooltipProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("not found in this browser");
  });

  it("shows source controls for the supplied complex Strudel song", async () => {
    const source = readFileSync("public/fixtures/coastline.strudel", "utf8");
    const { workspace } = await createWorkspace("Coastline controls", source);
    render(
      <TooltipProvider>
        <SessionWorkbench workspaceId={workspace.id} />
      </TooltipProvider>,
    );
    const controls = await screen.findByRole("button", { name: /source controls/ });
    expect(Number(controls.textContent?.split(" ")[0])).toBeGreaterThan(0);
    fireEvent.click(controls);
    expect(screen.getByRole("complementary", { name: "Track inspector" })).toBeInTheDocument();
    expect(
      screen.getByText(/Original audio routing is preserved; source controls below still work/),
    ).toBeInTheDocument();
  });

  it("opens the selected library document directly", async () => {
    const { workspace } = await createWorkspace("Library selection");
    const selected = await createDocument(workspace.id, "selected.js");
    render(
      <TooltipProvider>
        <SessionWorkbench workspaceId={workspace.id} initialDocumentId={selected.id} />
      </TooltipProvider>,
    );
    expect(await screen.findByRole("tab", { name: "selected.js" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("stops playback when closing the active song tab", async () => {
    vi.mocked(playback.play).mockClear();
    vi.mocked(playback.stop).mockClear();
    render(
      <TooltipProvider>
        <SessionWorkbench />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    await screen.findByRole("tab", { name: "night-bus.js" });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(playback.play).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Close night-bus.js tab" }));
    await waitFor(() => expect(playback.stop).toHaveBeenCalled());
  });

  it("keeps Stop available while a long evaluation is pending", async () => {
    let finish!: (value: boolean) => void;
    vi.mocked(playback.play).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(playback.stop).mockClear();
    const { workspace } = await createWorkspace("Pending playback", 's("bd")');
    render(
      <TooltipProvider>
        <SessionWorkbench workspaceId={workspace.id} />
      </TooltipProvider>,
    );
    await screen.findByRole("tab", { name: "night-bus.js" });
    fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    await waitFor(() => expect(playback.play).toHaveBeenCalled());
    const stop = screen.getByRole("button", { name: /^Stop$/ });
    expect(stop).toBeEnabled();
    fireEvent.click(stop);
    await waitFor(() => expect(playback.stop).toHaveBeenCalled());
    finish(false);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Play$/ })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Stop all audio" })).not.toBeInTheDocument();
    vi.mocked(playback.play).mockResolvedValue(true);
  });

  it("keeps side drawers mutually exclusive below 900px", async () => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    try {
      render(
        <TooltipProvider>
          <SessionWorkbench />
        </TooltipProvider>,
      );
      fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
      await screen.findByRole("tab", { name: "night-bus.js" });
      fireEvent.click(screen.getByRole("button", { name: "Show files" }));
      expect(screen.getByRole("button", { name: "Hide files" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Show inspector" }));
      expect(screen.getByRole("button", { name: "Show files" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Hide inspector" })).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
    }
  });

  it("resizes and expands the assistant without recreating its conversation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ available: true })),
    );
    try {
      render(
        <TooltipProvider>
          <SessionWorkbench />
        </TooltipProvider>,
      );
      fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
      await screen.findByRole("tab", { name: "night-bus.js" });
      fireEvent.click(await screen.findByRole("button", { name: "Show assistant" }));
      // Opening the pane loads its chat chunk and IndexedDB history asynchronously.
      const composer = await screen.findByRole(
        "textbox",
        { name: "Message the assistant" },
        { timeout: 5000 },
      );
      fireEvent.change(composer, { target: { value: "Keep this draft" } });
      const resize = screen.getByRole("separator", { name: "Resize Assistant pane" });
      fireEvent.keyDown(resize, { key: "Home" });
      expect(resize).toHaveAttribute("aria-valuenow", "280");
      fireEvent.keyDown(resize, { key: "End" });
      expect(Number(resize.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(800);
      expect(window.localStorage.getItem("jamscript-assistant-width")).toBe(
        resize.getAttribute("aria-valuenow"),
      );
      fireEvent.click(screen.getByRole("button", { name: "Expand assistant" }));
      expect(screen.getByRole("complementary", { name: "Assistant" })).toHaveClass("is-expanded");
      expect(
        screen.queryByRole("separator", { name: "Resize Assistant pane" }),
      ).not.toBeInTheDocument();
      expect(composer).toHaveValue("Keep this draft");
      fireEvent.click(screen.getByRole("button", { name: "Restore assistant sidebar" }));
      expect(screen.getByRole("textbox", { name: "Message the assistant" })).toBe(composer);
      expect(screen.getByRole("separator", { name: "Resize Assistant pane" })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("bounds sidebar resizing and supports keyboard fader-pane controls", async () => {
    render(
      <TooltipProvider>
        <SessionWorkbench />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    await screen.findByRole("tab", { name: "night-bus.js" });
    const activity = within(screen.getByRole("navigation", { name: "Workbench views" }));
    const showFiles = activity.queryByRole("button", { name: "Show files" });
    if (showFiles) fireEvent.click(showFiles);
    const showInspector = activity.queryByRole("button", { name: "Show inspector" });
    if (showInspector) fireEvent.click(showInspector);

    fireEvent.click(screen.getByRole("button", { name: "Expand inspector" }));
    expect(screen.getByRole("complementary", { name: "Track inspector" })).toHaveClass(
      "is-expanded",
    );
    expect(
      screen.queryByRole("separator", { name: "Resize Inspector pane" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore inspector sidebar" }));
    expect(screen.getByRole("complementary", { name: "Track inspector" })).not.toHaveClass(
      "is-expanded",
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
      activity
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
    await screen.findByRole("tab", { name: "second.js" }, { timeout: 5000 });
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
    await waitFor(() => expect(screen.getByText("Saved locally")).toBeInTheDocument(), {
      timeout: 5000,
    });
    await waitFor(async () => {
      const docs = await listDocuments(workspace!.id);
      expect(docs.find((item) => item.name === "night-bus.js")?.source).toContain("setcps(0.6)");
      expect(docs.some((item) => item.name === "second.js")).toBe(true);
    });
  });
});
