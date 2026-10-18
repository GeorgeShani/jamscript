import { useCallback, useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { bpmToCps, cpsToBpm } from "./tempo";

interface TempoControlProps {
  cps: number | null;
  beatsPerCycle?: number;
  editable?: boolean;
  onCpsChange: (cps: number, expectedCps: number | null) => boolean;
}

/** A BPM-first view that writes supported tempo changes through the editor. */
export function TempoControl({
  cps,
  beatsPerCycle = 4,
  editable = true,
  onCpsChange,
}: TempoControlProps) {
  const id = useId();
  const [draft, setDraft] = useState<{ text: string; cps: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bpm = cps === null ? null : cpsToBpm(cps, beatsPerCycle);
  const display = bpm === null ? "" : String(Number(bpm.toPrecision(12)));
  const disabled = !editable || (cps !== null && bpm === null);
  const explanation = disabled
    ? "Tempo is controlled by unsupported or ambiguous code. Edit the tempo in code."
    : `${beatsPerCycle} beats per cycle. ${cps === null ? "Set a tempo" : `${display} BPM = ${Number(cps.toPrecision(8))} CPS`}. Applies after typing pauses; Enter applies immediately and Escape cancels a pending edit.`;

  const commit = useCallback(() => {
    if (!draft || disabled) return;
    const nextCps = bpmToCps(Number(draft.text), beatsPerCycle);
    if (nextCps === null) {
      setError("Enter a BPM greater than zero.");
      return;
    }
    if (!onCpsChange(nextCps, draft.cps)) {
      setDraft(null);
      setError("Tempo changed in code. Review its value and try again.");
      return;
    }
    setDraft(null);
    setError(null);
  }, [draft, disabled, beatsPerCycle, onCpsChange]);

  useEffect(() => {
    if (!draft || disabled || bpmToCps(Number(draft.text), beatsPerCycle) === null) return;
    const timer = setTimeout(commit, 250);
    return () => clearTimeout(timer);
  }, [draft, disabled, beatsPerCycle, commit]);

  return (
    <div className="jam-tempo relative flex min-w-0 items-center gap-1" title={explanation}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        aria-label="Tempo in BPM"
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        aria-invalid={error ? true : undefined}
        className="code-face h-7 w-14 px-1 py-0 text-right text-ui [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={draft?.text ?? display}
        placeholder={disabled ? "Code" : "Set"}
        disabled={disabled}
        onChange={(event) => {
          setDraft({ text: event.target.value, cps: draft === null ? cps : draft.cps });
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
            setError(null);
          }
        }}
      />
      <label htmlFor={id} className="shrink-0 text-label text-muted-foreground">
        BPM
      </label>
      {!editable && cps === null && (
        <span className="text-label text-muted-foreground" role="status">
          Tempo from code
        </span>
      )}
      <span id={`${id}-help`} className="sr-only">
        {explanation}
      </span>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded border border-border bg-popover p-2 text-label text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
