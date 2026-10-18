import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MixerPanel } from "@/workbench/MixerPanel";
import { OutputPanel } from "@/workbench/OutputPanel";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * DESIGN.md: Keep sentence case and normal tracking; no all-caps labels.
 * Label role is 12px medium — panel chrome must not shout in uppercase.
 */
describe("workbench panel labels (DESIGN.md)", () => {
  it("uses sentence-case Mixer heading", () => {
    render(
      <MixerPanel
        tracks={[]}
        levels={{}}
        master={1}
        solo={null}
        muted={new Set()}
        selected={null}
        colors={{}}
        onLevel={() => undefined}
        onMaster={() => undefined}
        onSolo={() => undefined}
        onMute={() => undefined}
        onColor={() => undefined}
        onRename={() => false}
      />,
    );
    expect(screen.getByRole("heading", { name: "Mixer" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "MIXER" })).toBeNull();
  });

  it("uses sentence-case Output resize chrome", () => {
    render(
      <OutputPanel
        error={null}
        output={null}
        playing={false}
        problems={[]}
        onSelectProblem={() => undefined}
        onDismiss={() => undefined}
        takes={[]}
        liveSource=""
        onAuditionTake={() => undefined}
        onRestoreTake={() => undefined}
        auditionTakeId={null}
        onReturnToLive={() => undefined}
        canRestoreTake
        resizeHandle={{
          min: 110,
          max: 500,
          now: 174,
          onPointerDown: () => undefined,
          onPointerMove: () => undefined,
          onPointerEnd: () => undefined,
          onKeyDown: () => undefined,
        }}
      />,
    );
    expect(screen.getByText("Output", { selector: ".jam-output-heading-label" })).toBeTruthy();
    expect(screen.queryByText("OUTPUT")).toBeNull();
    expect(screen.getByText(/Drag to resize/i)).toBeTruthy();
  });

  it("keeps Files, Inspector and Assistant headings sentence-case in source", () => {
    const root = join(import.meta.dirname, "..");
    const workbench = readFileSync(join(root, "workbench/SessionWorkbench.tsx"), "utf8");
    const inspector = readFileSync(join(root, "workbench/TrackInspector.tsx"), "utf8");
    expect(workbench).toContain(">Files<");
    expect(workbench).toContain(">Assistant<");
    expect(workbench).not.toMatch(/>FILES</);
    expect(workbench).not.toMatch(/>ASSISTANT</);
    expect(inspector).toContain(">Inspector<");
    expect(inspector).not.toMatch(/>INSPECTOR</);
  });
});
