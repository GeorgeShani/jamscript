import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { syntaxProblems } from "@/features/language/syntax-problems";
import { fireEvent, render, screen } from "@testing-library/react";
import { OutputPanel } from "@/workbench/OutputPanel";

describe("syntax problems", () => {
  it("points at malformed code without evaluating it", () => {
    const problems = syntaxProblems('setcps(0.5)\ns("bd"');
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatchObject({ line: 2 });
  });

  it("accepts the full coastline source", () => {
    const source = readFileSync("public/fixtures/coastline.strudel", "utf8");
    expect(syntaxProblems(source)).toEqual([]);
  });

  it("shows a real problem and opens its source range", () => {
    const problem = syntaxProblems('s("bd"')[0]!;
    const onSelectProblem = vi.fn();
    render(
      <OutputPanel
        error={null}
        output={null}
        playing={false}
        problems={[problem]}
        onSelectProblem={onSelectProblem}
        onDismiss={vi.fn()}
        takes={[]}
        liveSource=""
        auditionTakeId={null}
        onAuditionTake={vi.fn()}
        onRestoreTake={vi.fn()}
        onReturnToLive={vi.fn()}
        canRestoreTake={false}
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
    fireEvent.click(screen.getByRole("tab", { name: "Problems (1)" }));
    fireEvent.click(screen.getByRole("button", { name: /Incomplete JavaScript syntax/ }));
    expect(onSelectProblem).toHaveBeenCalledWith(problem);
  });
});
