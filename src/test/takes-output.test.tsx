import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OutputPanel } from "@/workbench/OutputPanel";
import type { TakeRecord } from "@/features/takes/take-store";

describe("real Takes panel", () => {
  it("offers audition and editor restore for a selected saved source", () => {
    const take: TakeRecord = {
      id: "take-1",
      documentId: "song-1",
      source: 's("bd")',
      createdAt: 1_700_000_000_000,
    };
    const onAuditionTake = vi.fn();
    const onRestoreTake = vi.fn();
    render(
      <OutputPanel
        error={null}
        output={null}
        playing={false}
        problems={[]}
        onSelectProblem={vi.fn()}
        onDismiss={vi.fn()}
        takes={[take]}
        liveSource={'s("sd")'}
        onAuditionTake={onAuditionTake}
        onRestoreTake={onRestoreTake}
        auditionTakeId={null}
        onReturnToLive={vi.fn()}
        canRestoreTake
        resizeHandle={{
          min: 110,
          max: 500,
          now: 174,
          onPointerDown: vi.fn(),
          onPointerMove: vi.fn(),
          onPointerEnd: vi.fn(),
          onKeyDown: vi.fn(),
        }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Takes (1)" }));
    fireEvent.click(
      screen.getByRole("button", { name: new Date(take.createdAt).toLocaleString() }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore to editor" }));
    expect(onAuditionTake).toHaveBeenCalledWith(take);
    expect(onRestoreTake).toHaveBeenCalledWith(take);
  });
});
