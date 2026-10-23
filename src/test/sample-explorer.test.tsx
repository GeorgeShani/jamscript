import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const sounds = [
  ...Array.from({ length: 60 }, (_, index) => ({ name: `RolandTR808_s${index}`, count: 1 })),
  ...Array.from({ length: 40 }, (_, index) => ({ name: `piano${index}`, count: 3 })),
];
vi.mock("@/engine/playback", () => ({
  listRegisteredSamples: vi.fn(async () => sounds),
  auditionSample: vi.fn(),
  stopSamplePreview: vi.fn(),
  setSamplePreviewVolume: vi.fn(),
}));

import { SampleExplorer } from "@/workbench/SampleExplorer";

async function open() {
  render(<SampleExplorer />);
  await act(async () => {});
}

describe("Sample explorer", () => {
  it("loads every sound on open and lets you reach all of them", async () => {
    await open();
    expect(screen.getByText("Showing 48 of 100 sounds")).not.toBeNull();
    fireEvent.click(screen.getByText("Show all"));
    expect(screen.getByText("Showing 100 of 100 sounds")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /^Audition / })).toHaveLength(100);
  });

  it("narrows by bank and by search", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Sample bank"), { target: { value: "RolandTR808" } });
    expect(screen.getByText(/Showing 48 of 60 matching/)).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Sample bank"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter registered samples"), {
      target: { value: "piano1" },
    });
    // piano1 and piano10–19
    expect(screen.getByText(/Showing 11 of 11 matching/)).not.toBeNull();
  });
});
