import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReviewExample } from "@/features/review/review-fixtures";
import { TAKE_COMPARISONS, TAKE_FIXTURES, type TakeFixture } from "./take-fixtures";

interface TakesRailProps {
  fixture?: TakeFixture;
  onCompare: (review: ReviewExample, launcher: HTMLElement) => void;
}

/** Presentation only. Real capture, audition and restoration await src/engine. */
export function TakesRail({ fixture = TAKE_FIXTURES.examples, onCompare }: TakesRailProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const explanationId = useId();
  const list = useRef<HTMLDivElement>(null);
  const selected =
    fixture.status === "examples"
      ? fixture.takes.find((take) => take.id === selectedId)
      : undefined;

  return (
    <nav aria-label="Takes" className="jam-takes min-w-0 shrink-0 border-t border-border bg-card">
      <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex shrink-0 items-baseline gap-2">
          <span className="text-ui font-medium">Takes</span>
          <span className="text-label text-muted-foreground">Examples</span>
        </div>
        {fixture.status === "examples" ? (
          <>
            <div
              ref={list}
              role="group"
              aria-label="Example Take list"
              tabIndex={0}
              className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain px-1 py-1"
            >
              {fixture.takes.map((take) => {
                const current = take.id === fixture.currentId;
                return (
                  <Button
                    key={take.id}
                    size="sm"
                    variant="outline"
                    data-take-id={take.id}
                    aria-pressed={selectedId === take.id}
                    aria-current={current ? "true" : undefined}
                    aria-label={`Example Take ${take.time}, ${take.label}${current ? ", current example" : ""}`}
                    className={cn(
                      "jam-take-chip shrink-0 border-border bg-transparent",
                      current && "border-primary",
                      selectedId === take.id && "bg-selection hover:bg-selection",
                    )}
                    onClick={(event) => {
                      setSelectedId(selectedId === take.id ? null : take.id);
                      // Only a deliberate selection scrolls, and only if the chip is clipped.
                      const bounds = event.currentTarget.getBoundingClientRect();
                      const viewport = list.current?.getBoundingClientRect();
                      if (
                        viewport &&
                        (bounds.left < viewport.left || bounds.right > viewport.right)
                      ) {
                        list.current?.scrollBy({
                          left:
                            bounds.left < viewport.left
                              ? bounds.left - viewport.left
                              : bounds.right - viewport.right,
                          behavior: "auto",
                        });
                      }
                    }}
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", take.dot)} aria-hidden />
                    <span className="code-face">{take.time}</span>
                    <span className="text-label font-medium">{take.label}</span>
                  </Button>
                );
              })}
            </div>
            {selected && (
              <div
                role="group"
                aria-label={`Actions for example Take ${selected.time}`}
                className="flex basis-full flex-wrap items-center gap-2 min-[1024px]:basis-auto"
              >
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(event) => onCompare(TAKE_COMPARISONS[selected.id], event.currentTarget)}
                >
                  Compare
                </Button>
                <Button size="sm" variant="outline" disabled aria-describedby={explanationId}>
                  Audition
                </Button>
                <Button size="sm" variant="outline" disabled aria-describedby={explanationId}>
                  Restore
                </Button>
              </div>
            )}
          </>
        ) : fixture.status === "auditioning" ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-ui">
              Auditioning <span className="code-face">{fixture.time}</span>
            </span>
            <span className="text-label text-muted-foreground">Example state only</span>
            <Button size="sm" variant="outline" disabled aria-describedby={explanationId}>
              Restore
            </Button>
            <Button size="sm" variant="outline" disabled aria-describedby={explanationId}>
              Back to live
            </Button>
          </div>
        ) : (
          <p role="status" className="min-w-0 text-ui text-muted-foreground">
            {fixture.status === "empty"
              ? "No takes yet. Your first successful play will appear here."
              : fixture.status === "loading"
                ? "Loading Takes"
                : "Takes unavailable"}
          </p>
        )}
      </div>
      <p
        id={explanationId}
        className={cn(
          "text-label leading-5 text-muted-foreground",
          selected || fixture.status !== "examples" ? "pt-2" : "sr-only",
        )}
      >
        {fixture.status === "examples" && (
          <span>Example Takes. Real history is not connected. </span>
        )}
        Audition and restore will be available when Takes are connected.
      </p>
    </nav>
  );
}
