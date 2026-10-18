import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TempoControl } from "@/features/tempo/TempoControl";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { changeEditorTempo } from "@/features/tempo/tempo-editor";

vi.mock("@/engine/playback", () => ({
  onError: vi.fn(),
  onHighlight: vi.fn(),
  play: vi.fn().mockResolvedValue(true),
  stop: vi.fn().mockResolvedValue(undefined),
  setMix: vi.fn(),
}));
vi.mock("@/workbench/AuthControls", () => ({ AuthControls: () => null }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BPM control", () => {
  async function openExample() {
    render(
      <TooltipProvider>
        <SessionWorkbench />
      </TooltipProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /A Strudel session/ }));
    const tempo = await screen.findByRole("spinbutton", { name: "Tempo in BPM" });
    await waitFor(() => expect(tempo).toHaveValue(144));
    return tempo;
  }
  it("shows BPM and commits converted CPS immediately on Enter", () => {
    const onCpsChange = vi.fn(() => true);
    render(<TempoControl cps={0.5} onCpsChange={onCpsChange} />);
    const input = screen.getByRole("spinbutton", { name: "Tempo in BPM" });
    expect(input).toHaveValue(120);
    fireEvent.change(input, { target: { value: "180" } });
    expect(onCpsChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCpsChange).toHaveBeenCalledExactlyOnceWith(0.75, 0.5);
  });

  it("updates source after typing pauses without Enter or blur", async () => {
    const tempo = await openExample();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(tempo, { target: { value: "180" } });
    act(() => vi.advanceTimersByTime(150));
    fireEvent.change(tempo, { target: { value: "120" } });
    act(() => vi.advanceTimersByTime(200));
    expect(document.querySelector(".cm-line")?.textContent).toBe("setcps(0.6);");
    act(() => vi.advanceTimersByTime(100));
    expect(document.querySelector(".cm-line")?.textContent).toBe("setcps(0.5);");
    expect(tempo).toHaveValue(120);
  });

  it("uses the configured beats per cycle and commits on blur", () => {
    const onCpsChange = vi.fn(() => true);
    render(<TempoControl cps={0.5} beatsPerCycle={3} onCpsChange={onCpsChange} />);
    const input = screen.getByRole("spinbutton", { name: "Tempo in BPM" });
    expect(input).toHaveValue(90);
    fireEvent.change(input, { target: { value: "120" } });
    fireEvent.blur(input);
    expect(onCpsChange).toHaveBeenCalledExactlyOnceWith(2 / 3, 0.5);
  });

  it("cancels a draft with Escape and refuses invalid values", () => {
    const onCpsChange = vi.fn(() => true);
    render(<TempoControl cps={0.5} onCpsChange={onCpsChange} />);
    const input = screen.getByRole("spinbutton", { name: "Tempo in BPM" });
    fireEvent.change(input, { target: { value: "180" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(input).toHaveValue(120);
    expect(onCpsChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("greater than zero");
    expect(onCpsChange).not.toHaveBeenCalled();
  });

  it("discloses code-controlled tempo and reports rejected stale drafts", () => {
    const onCpsChange = vi.fn(() => false);
    const view = render(<TempoControl cps={null} editable={false} onCpsChange={onCpsChange} />);
    const input = screen.getByRole("spinbutton", { name: "Tempo in BPM" });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Code");
    view.rerender(<TempoControl cps={0.5} onCpsChange={onCpsChange} />);
    fireEvent.change(input, { target: { value: "180" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("changed in code");
  });

  it("patches the actual workbench source and follows its undo history", async () => {
    const tempo = await openExample();
    const editor = screen.getByRole("textbox", { name: "Music code" });
    expect(tempo).toHaveValue(144);
    fireEvent.change(tempo, { target: { value: "120" } });
    fireEvent.keyDown(tempo, { key: "Enter" });
    expect(document.querySelector(".cm-line")?.textContent).toBe("setcps(0.5);");
    expect(tempo).toHaveValue(120);
    fireEvent.keyDown(editor, { key: "z", code: "KeyZ", ctrlKey: true });
    expect(document.querySelector(".cm-line")?.textContent).toBe("setcps(0.6);");
    expect(tempo).toHaveValue(144);
  });

  it("keeps advanced tempo settings collapsed until requested", async () => {
    await openExample();
    const summary = screen.getByText("Tempo settings");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("combobox", { name: "Beats per cycle" })).toBeInTheDocument();
  });

  it("refuses a programmatic BPM write in a viewer editor", () => {
    const view = new EditorView({
      parent: document.createElement("div"),
      state: EditorState.create({
        doc: 'setcps(0.5); s("bd")',
        extensions: [EditorView.editable.of(false)],
      }),
    });
    expect(changeEditorTempo(view, 0.75, 0.5)).toBe(false);
    expect(view.state.doc.toString()).toBe('setcps(0.5); s("bd")');
    view.destroy();
  });
});
