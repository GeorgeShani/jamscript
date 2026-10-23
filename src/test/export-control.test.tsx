import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportControl } from "@/workbench/ExportControl";
import { exportLength } from "@/engine/export-audio";

function setup() {
  const onExport = vi.fn();
  render(
    <ExportControl
      disabled={false}
      exporting={false}
      progress={0}
      onExport={onExport}
      onCancel={vi.fn()}
    />,
  );
  return onExport;
}

describe("Export length in time", () => {
  it("offers lengths in seconds and minutes instead of bars", () => {
    setup();
    const options = [...screen.getByLabelText("Export length").querySelectorAll("option")].map(
      (option) => option.textContent,
    );
    expect(options).toEqual([
      "15 seconds",
      "30 seconds",
      "1 minute",
      "2 minutes",
      "5 minutes",
      "Custom…",
    ]);
    expect(screen.queryByText(/bars/i)).toBeNull();
  });

  it("exports the chosen preset in the chosen format", () => {
    const onExport = setup();
    fireEvent.change(screen.getByLabelText("Export length"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Export format"), { target: { value: "mp3" } });
    fireEvent.click(screen.getByText("Record & download"));
    expect(onExport).toHaveBeenCalledWith("mp3", 120);
  });

  it("accepts a custom length and blocks one outside the allowed range", () => {
    const onExport = setup();
    fireEvent.change(screen.getByLabelText("Export length"), { target: { value: "custom" } });
    const field = screen.getByLabelText("Custom export length in seconds");
    fireEvent.change(field, { target: { value: "5000" } });
    fireEvent.click(screen.getByText("Record & download"));
    // The browser's own validation stops a value above 10 minutes before it is submitted.
    expect(onExport).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "90" } });
    fireEvent.click(screen.getByText("Record & download"));
    expect(onExport).toHaveBeenCalledWith("wav", 90);
  });
  it("rounds the recording up to the end of a loop", () => {
    // 120 BPM with four beats per cycle is 0.5 cycles per second: one loop lasts 2 seconds.
    expect(exportLength(30, 0.5)).toEqual({ cycles: 15, seconds: 30 });
    expect(exportLength(31, 0.5)).toEqual({ cycles: 16, seconds: 32 });
    expect(exportLength(0.1, 0.5).cycles).toBe(1);
  });
});
