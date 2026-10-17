import { useId, useRef, useState, type RefObject } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  REWORK_FIXTURES,
  REWORK_SAMPLE_REQUEST,
  REWORK_UNAVAILABLE,
  reworkRequestKind,
} from "./rework-fixtures";
import type { ReviewExample } from "@/features/review/review-fixtures";

export function ReworkBar({
  inputRef,
  onPreview,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onPreview: (review: ReviewExample, launcher: HTMLElement | null) => void;
}) {
  const [request, setRequest] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const submit = useRef<HTMLButtonElement>(null);
  const helpId = useId();
  const errorId = useId();
  const requestKind = reworkRequestKind(request);
  return (
    <form
      className="jam-rework grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-border bg-card"
      onSubmit={(event) => {
        event.preventDefault();
        if (requestKind === "empty") return;
        if (requestKind === "unavailable") {
          setUnavailable(true);
          return;
        }
        setUnavailable(false);
        onPreview(
          REWORK_FIXTURES.normal,
          document.activeElement === inputRef.current ? inputRef.current : submit.current,
        );
      }}
    >
      <div className="relative min-w-0">
        <Sparkles
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ai"
          aria-hidden
        />
        <Input
          ref={inputRef}
          aria-label="Ask for a change"
          aria-describedby={`${helpId}${unavailable ? ` ${errorId}` : ""}`}
          placeholder="Ask for a change, like 'busier hats, keep the kick'"
          value={request}
          onChange={(event) => {
            setRequest(event.target.value);
            setUnavailable(false);
          }}
          className="jam-rework-input pl-10"
        />
      </div>
      <Button
        ref={submit}
        size="sm"
        variant="outline"
        className="jam-proposal-button"
        type="submit"
        disabled={requestKind === "empty"}
      >
        Preview proposal
      </Button>
      <div className="jam-rework-help col-span-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <span id={helpId} className="text-label text-muted-foreground">
          Rework preview
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-4 max-w-full justify-start whitespace-normal px-0 py-0 text-label"
          aria-label={`Example request: ${REWORK_SAMPLE_REQUEST}`}
          onClick={() => {
            setRequest(REWORK_SAMPLE_REQUEST);
            setUnavailable(false);
            inputRef.current?.focus({ preventScroll: true });
          }}
        >
          Example: {REWORK_SAMPLE_REQUEST}
        </Button>
        <span className="jam-attribution text-label text-muted-foreground">
          Built on{" "}
          <a
            href="https://strudel.cc"
            target="_blank"
            rel="noopener noreferrer"
            className="underline jam-transition hover:text-foreground"
          >
            Strudel
          </a>
          <span className="sr-only"> (AGPL-3.0-or-later)</span>{" "}
          <a
            href="/licenses/THIRD_PARTY_NOTICES.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="underline jam-transition hover:text-foreground"
          >
            Licences
          </a>
        </span>
      </div>
      {unavailable && (
        <p
          id={errorId}
          role="status"
          className="col-span-2 min-w-0 pb-1 text-label text-muted-foreground"
        >
          {REWORK_UNAVAILABLE}
        </p>
      )}
    </form>
  );
}
