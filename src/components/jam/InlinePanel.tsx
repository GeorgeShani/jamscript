import { useEffect, useId, useRef } from "react";
import { Check, Clock, CircleHelp, CircleX, CircleMinus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReviewCheckStatus, ReviewExample } from "./review-fixtures";

const CHECK_PRESENTATION = {
  notChecked: { Icon: CircleHelp, text: "Not checked", tone: "text-muted-foreground" },
  passed: { Icon: Check, text: "Passed", tone: "text-success" },
  failed: { Icon: CircleX, text: "Failed", tone: "text-destructive" },
  pending: { Icon: Clock, text: "Pending", tone: "text-muted-foreground" },
  unavailable: { Icon: CircleMinus, text: "Unavailable", tone: "text-muted-foreground" },
} satisfies Record<ReviewCheckStatus, { Icon: typeof Check; text: string; tone: string }>;

/** Presentation only: one static renderer for every review; no diff calculation or apply path. */
export function ReviewPanel({ review, onClose }: { review: ReviewExample; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const exampleId = useId();
  const applyHelpId = useId();

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [review]);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Radix owns its topmost transient layer. A second Escape can dismiss the review.
      if (document.querySelector('[data-review-transient][data-state="open"], [role="tooltip"]')) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <section role="region" aria-labelledby={headingId} aria-describedby={exampleId}
      className="absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col border-t border-border bg-card">
      <header className="min-w-0 shrink-0 space-y-1 border-b border-border px-3 py-2">
        <h2 ref={heading} id={headingId} tabIndex={-1}
          className={cn("flex min-w-0 items-center gap-2 break-words text-ui font-semibold focus-visible:outline-ring", review.kind === "rework" && "text-ai")}>
          {review.kind === "rework" && <Sparkles className="size-4 shrink-0" aria-hidden />}
          {review.title}
        </h2>
        <p id={exampleId} className="text-label text-muted-foreground">Example diff</p>
      </header>
      <div role="region" aria-label="Example diff body" tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain focus-visible:outline-ring">
        {review.comparison && <div className="space-y-1 px-3 pt-2 text-ui">
          <p>Selected example: {review.comparison.selected}</p>
          <p>Current example: {review.comparison.current}</p>
        </div>}
        {review.summary && <p className="px-3 py-2 text-ui text-muted-foreground">{review.summary}</p>}
        <div role="region" aria-label="Example code changes" tabIndex={0}
          className="code-line min-w-0 overflow-x-auto overscroll-x-contain bg-background py-1 focus-visible:outline-ring">
          {review.lines.map((line, i) => (
            <div key={i} className={cn("flex w-max min-w-full items-start gap-2 whitespace-pre px-3", line.kind === "-" ? "bg-destructive/20" : "bg-success/20")}>
              <span className="sr-only">{line.kind === "-" ? "Removed" : "Added"}</span>
              <span aria-hidden className={line.kind === "-" ? "text-destructive" : "text-success"}>{line.kind}</span>
              <code>{line.text}</code>
            </div>
          ))}
        </div>
        {review.checks && <ul className="space-y-1 px-3 py-2 text-ui">
          {review.checks.map((check) => {
            const { Icon, text, tone } = CHECK_PRESENTATION[check.status];
            return <li key={check.label} className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <Icon className={cn("size-4 shrink-0", tone)} aria-hidden />{check.label}<span className={tone}>{text}</span>
            </li>;
          })}
        </ul>}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        {review.kind === "rework" && <Button size="sm" disabled aria-label="Accept change, unavailable in this example" aria-describedby={applyHelpId}><Check />Accept change</Button>}
        <Button size="sm" variant="outline" onClick={onClose}>{review.kind === "rework" ? "Discard" : review.kind === "take" ? "Close comparison" : "Close"}</Button>
        {review.kind === "rework" && <p id={applyHelpId} className="w-full text-label text-muted-foreground">Checks and applying changes are not connected yet.</p>}
      </footer>
    </section>
  );
}