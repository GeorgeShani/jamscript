// Placeholder editor. The real CodeMirror editor comes from src/engine later.
// The lens strips below are static mocks too; the real lenses are derived from the code by src/engine.
import { createContext, useContext, useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SAMPLE_CODE, LENS_SPANS, TRACK_RULE, type LensKey } from "./session";

type LinkSource = "pointer" | "focus" | "all";
type LinkHandler = (id: LensKey | null, source: LinkSource) => void;

/* ---------- hand-written one-line tokenizer (no editor library) ---------- */

interface Tok {
  text: string;
  cls: string;
  lens: LensKey | null;
}

const TOKEN_RE = /"[^"]*"|\d+(?:\.\d+)?|[A-Za-z_]\w*|./gs;

function lensForRange(line: number, start: number, end: number): LensKey | null {
  for (const [key, span] of Object.entries(LENS_SPANS) as [LensKey, (typeof LENS_SPANS)[LensKey]][]) {
    if (span.line === line && start === span.start && end === span.end) return key;
  }
  return null;
}

function tokenize(line: string, lineNo: number): Tok[] {
  const toks: Tok[] = [];
  for (const m of line.matchAll(TOKEN_RE)) {
    const text = m[0];
    const start = m.index ?? 0;
    const end = start + text.length;
    const lens = lensForRange(lineNo, start, end);
    if (text.startsWith('"')) {
      // mini-notation string: pattern colour, with ~, brackets and * < > in Paper Dim
      const inner = text.slice(1, -1).split(/([~[\]*<>])/);
      toks.push({ text: '"', cls: "text-syn-pattern", lens });
      for (const part of inner) {
        if (!part) continue;
        const dim = /^[~[\]*<>]$/.test(part);
        toks.push({ text: part, cls: dim ? "text-muted-foreground" : "text-syn-pattern", lens });
      }
      toks.push({ text: '"', cls: "text-syn-pattern", lens });
    } else if (/^\d/.test(text)) {
      toks.push({ text, cls: "text-syn-number", lens });
    } else if (/^[A-Za-z_]/.test(text)) {
      const next = line[end];
      const prev = start > 0 ? line[start - 1] : "";
      if (start === 0 && next === ":") toks.push({ text, cls: "font-medium text-foreground", lens });
      else if (next === "(" || prev === ".") toks.push({ text, cls: "text-syn-function", lens });
      else toks.push({ text, cls: "text-foreground", lens });
    } else {
      toks.push({ text, cls: "text-foreground", lens });
    }
  }
  return toks;
}

/* ---------- editor with interleaved lens strips ---------- */

const STRIP_AFTER: Record<number, { track: string; lenses: LensKey[] }> = {
  2: { track: "drums", lenses: ["drums-rhythm"] },
  3: { track: "hats", lenses: ["hats-rhythm", "hats-gain"] },
  4: { track: "bass", lenses: ["bass-lpf", "bass-room"] },
  5: { track: "perc", lenses: ["perc-rhythm"] },
};

export function EditorSlot({ panelOpen = false }: { panelOpen?: boolean }) {
  // Presentation state only. The immutable song fixture is never rewritten.
  const [hovered, setHovered] = useState<LensKey | null>(null);
  const [focused, setFocused] = useState<LensKey | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [introducing, setIntroducing] = useState(true);
  const previewDescriptionId = useId();
  const lines = SAMPLE_CODE.split("\n");
  const highlighted = panelOpen ? null : focused ?? hovered ?? (introducing ? "bass-lpf" : null);
  const onLink: LinkHandler = (id, source) => {
    if (panelOpen) return;
    if (id) setIntroducing(false);
    if (source === "pointer" || source === "all") setHovered(id);
    if (source === "focus" || source === "all") setFocused(id);
  };

  useEffect(() => {
    setHovered(null);
    setFocused(null);
    if (panelOpen) setIntroducing(false);
  }, [panelOpen]);

  useEffect(() => {
    if (!introducing) return;
    const interactElsewhere = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-introduction-lens="bass-lpf"]')) {
        setIntroducing(false);
      }
    };
    document.addEventListener("pointerdown", interactElsewhere);
    document.addEventListener("focusin", interactElsewhere);
    document.addEventListener("keydown", interactElsewhere);
    return () => {
      document.removeEventListener("pointerdown", interactElsewhere);
      document.removeEventListener("focusin", interactElsewhere);
      document.removeEventListener("keydown", interactElsewhere);
    };
  }, [introducing]);

  return (
    <ReviewOpenContext.Provider value={panelOpen}>
    <PreviewDescriptionContext.Provider value={previewDescriptionId}>
    <div inert={panelOpen} className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <p id={previewDescriptionId} className="sr-only">Control preview. Code and sound are unchanged.</p>
      {showIntro && (
        <div className="jam-first-use grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border text-ui">
          <p className="min-w-0 flex-1">
            <span className="mr-3 font-medium">UI preview</span>
            <span className="text-muted-foreground">Press Play to hear Night bus. Controls preview the UI; code and sound stay unchanged.</span>
          </p>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Dismiss" onClick={() => { setShowIntro(false); setIntroducing(false); }}>
            <X />
          </Button>
        </div>
      )}
      <div role="region" aria-label="Code" tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
      <div className="jam-editor-document code-line">
        {lines.map((text, i) => {
          const n = i + 1;
          const strip = STRIP_AFTER[n];
          return (
            <div key={n} className="jam-statement min-w-0">
              <div role="region" aria-label={`Code line ${n}`} tabIndex={0} className="min-w-0 overflow-x-auto overscroll-x-contain">
              <div className="jam-code-row flex w-max min-w-full items-center">
                <span className="jam-line-number shrink-0 select-none pr-4 text-right text-muted-foreground/60">{n}</span>
                <code className="whitespace-pre pr-4">
                  {groupTokens(tokenize(text, n)).map((group, j) => {
                    const lens = group[0]?.lens;
                    return (
                    <span
                      key={j}
                      data-code-lens={lens ?? undefined}
                      data-introduction-lens={lens ?? undefined}
                      tabIndex={lens ? 0 : undefined}
                      aria-label={lens ? `${lens.replaceAll("-", " ")} sample token` : undefined}
                      onMouseEnter={() => lens && onLink(lens, "pointer")}
                      onMouseLeave={() => lens && onLink(null, "pointer")}
                      onFocus={() => lens && onLink(lens, "focus")}
                      onBlur={() => lens && onLink(null, "focus")}
                      className={cn(lens && "jam-transition focus-visible:outline-ring", lens && highlighted === lens && "bg-link/25", introducing && lens === "bass-lpf" && "rounded-sm ring-2 ring-link ring-offset-2 ring-offset-background transition-none")}
                    >
                      {group.map((t, k) => <span key={k} className={t.cls}>{t.text}</span>)}
                    </span>
                    );
                  })}
                </code>
              </div>
              </div>
              {strip && (
                <LensStrip track={strip.track}>
                  {strip.lenses.map((id) => renderLens(id, highlighted, onLink, introducing))}
                </LensStrip>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
    </PreviewDescriptionContext.Provider>
    </ReviewOpenContext.Provider>
  );
}

function LensStrip({
  track,
  children,
}: {
  track: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-label={`${track} lenses`}
      className="jam-lens-strip min-w-0 flex flex-wrap items-center border-l-2 font-sans"
      style={{ borderLeftColor: TRACK_RULE[track] }}
    >
      {children}
    </div>
  );
}

// Description context survives dismissal; every usable mock exposes it directly.
const PreviewDescriptionContext = createContext<string | undefined>(undefined);
const ReviewOpenContext = createContext(false);

function renderLens(id: LensKey, linked: LensKey | null, onLink: LinkHandler, introducing: boolean): ReactNode {
  switch (id) {
    case "drums-rhythm":
      return (
        <LensShell key={id} id={id} label="drums pattern" linked={linked} onLink={onLink}>
          <RhythmLens track="drums" sounds={["bd", "bd", "sd", "sd", "bd", "bd", "sd", "sd"]} initial={[1, 0, 1, 0, 1, 1, 1, 0]} />
        </LensShell>
      );
    case "hats-rhythm":
      return (
        <LensShell key={id} id={id} label="hats pattern" linked={linked} onLink={onLink}>
          <RhythmLens track="hats" sounds={["hh", "hh", "hh", "hh"]} initial={[1, 1, 1, 1]} />
        </LensShell>
      );
    case "hats-gain":
      return (
        <LensShell key={id} id={id} label="gain knob" linked={linked} onLink={onLink}>
          <Knob track="hats" name="gain" min={0} max={1} step={0.01} initial={0.6} format={(v) => v.toFixed(2)} />
        </LensShell>
      );
    case "bass-lpf":
      return (
        <LensShell key={id} id={id} label="lpf knob" linked={linked} onLink={onLink} introducing={introducing}>
          <Knob
            name="lpf"
            track="bass"
            min={50}
            max={20000}
            step={10}
            initial={1200}
            format={(v) => `${Math.round(v)} Hz`}
          />
        </LensShell>
      );
    case "bass-room":
      return (
        <LensShell key={id} id={id} label="room knob" linked={linked} onLink={onLink}>
          <Knob track="bass" name="room" min={0} max={1} step={0.01} initial={0.2} format={(v) => v.toFixed(2)} />
        </LensShell>
      );
    case "perc-rhythm":
      return <LockedRhythm key={id} linked={linked === id} onLink={onLink} id={id} />;
    default:
      return null;
  }
}

/** Wrapper that owns the linked highlight for one lens. */
function LensShell({
  id,
  label,
  linked,
  onLink,
  introducing = false,
  children,
}: {
  id: LensKey;
  label: string;
  linked: LensKey | null;
  onLink: LinkHandler;
  introducing?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-label={label}
      data-lens={id}
      data-introduction-lens={id}
      onMouseEnter={() => onLink(id, "pointer")}
      onMouseLeave={() => onLink(null, "pointer")}
      onFocus={() => onLink(id, "focus")}
      onBlur={(e) => {
        if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) onLink(null, "focus");
      }}
      className={cn(
        "min-w-0 max-w-full w-fit rounded-sm jam-transition",
        linked === id && "ring-2 ring-link ring-offset-2 ring-offset-background",
        introducing && "transition-none",
      )}
    >
      {children}
    </div>
  );
}

function RhythmLens({ track, sounds, initial }: { track: string; sounds: string[]; initial: number[] }) {
  const descriptionId = useContext(PreviewDescriptionContext);
  // Synthetic cell previews only; not source or playback state.
  const [cells, setCells] = useState(initial.map(Boolean));
  return (
    <div role="group" aria-label={`${track} pattern`} className="jam-rhythm flex min-w-0 flex-wrap gap-4">
      {chunk(cells, 4).map((group, g) => (
        <div key={g} className="jam-rhythm-group flex shrink-0">
          {group.map((on, j) => {
            const i = g * 4 + j;
            return (
              <Button
                key={i}
                type="button"
                aria-pressed={on}
                aria-label={`${track}, step ${i + 1}, ${on ? sounds[i] : "rest"}`}
                aria-describedby={descriptionId}
                variant="ghost"
                size="icon"
                onClick={() => setCells((c) => c.map((v, k) => (k === i ? !v : v)))}
                className={cn(
                  "jam-rhythm-cell shrink-0 cursor-pointer rounded-sm p-0 jam-transition active:brightness-90 focus-visible:outline-ring",
                  on ? "bg-primary text-primary-foreground hover:bg-primary hover:brightness-110" : "border border-input bg-muted hover:bg-selection",
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function LockedRhythm({
  id,
  linked,
  onLink,
}: {
  id: LensKey;
  linked: boolean;
  onLink: LinkHandler;
}) {
  const descriptionId = useContext(PreviewDescriptionContext);
  const reasonId = useId();
  const [reasonOpen, setReasonOpen] = useState(false);
  const reviewOpen = useContext(ReviewOpenContext);
  useEffect(() => { setReasonOpen(false); }, [reviewOpen]);
  const cells = [1, 1, 0, 1, 1, 0, 1, 1];
  return (
    <LensShell id={id} label="perc locked lens" linked={linked ? id : null} onLink={onLink}>
    <p id={reasonId} className="sr-only">Edit this one in code. This pattern is outside what a lens can change safely.</p>
    <Tooltip open={reasonOpen && !reviewOpen} onOpenChange={setReasonOpen}>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          role="group"
          aria-label="perc pattern, locked"
          aria-describedby={`${descriptionId ?? ""} ${reasonId}`.trim()}
          aria-disabled
          onFocus={() => setReasonOpen(true)}
          onBlur={() => setReasonOpen(false)}
          onMouseEnter={() => setReasonOpen(true)}
          onMouseLeave={() => setReasonOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setReasonOpen(false);
              onLink(null, "all");
            }
          }}
          className={cn(
            "flex min-w-0 max-w-full w-fit flex-wrap items-center gap-3 rounded-sm opacity-50 jam-transition focus-visible:outline-ring",
          )}
        >
          <Lock className="size-4 shrink-0" aria-hidden />
          {chunk(cells, 4).map((group, g) => (
            <div key={g} className="jam-rhythm-group flex shrink-0">
              {group.map((on, j) => (
                <span
                  key={j}
                  aria-hidden
                  className={cn("jam-rhythm-cell rounded-sm", on ? "bg-primary" : "border border-input bg-muted")}
                />
              ))}
            </div>
          ))}
          <span className="min-w-0 basis-full text-label font-medium min-[700px]:basis-auto">Edit this one in code</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Edit this one in code. This pattern is outside what a lens can change safely.
      </TooltipContent>
    </Tooltip>
    </LensShell>
  );
}

/** Placeholder knob (audiocn is not installed): a static circle, exposed as a slider. */
function Knob({
  track,
  name,
  min,
  max,
  step,
  initial,
  format,
}: {
  track: string;
  name: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  format: (v: number) => string;
}) {
  const descriptionId = useContext(PreviewDescriptionContext);
  // Synthetic value preview only; does not modify SAMPLE_CODE or playback.
  const [value, setValue] = useState(initial);
  // Linear presentation bounds only; musical ranges and gesture transactions belong to src/engine.
  const toPos = (v: number) => (v - min) / (max - min);
  const onKey = (e: KeyboardEvent) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setValue(e.key === "Home" ? min : max);
      return;
    }
    if (!dir) return;
    e.preventDefault();
    const n = dir * (e.shiftKey ? 10 : 1);
    setValue((v) => Math.round(Math.min(max, Math.max(min, v + n * step)) * 100) / 100);
  };
  const angle = -135 + toPos(value) * 270;
  return (
    <div className="flex items-center gap-3">
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${track} ${name}`}
        aria-describedby={descriptionId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${format(value)}${name === "lpf" ? " low-pass cutoff" : ` ${name}`}, control preview`}
        onKeyDown={onKey}
        className="jam-knob relative shrink-0 cursor-pointer rounded-full border border-input bg-muted jam-transition hover:bg-selection active:bg-accent focus-visible:outline-ring"
      >
        <span
          aria-hidden
          className="jam-knob-indicator absolute left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-primary"
          style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
        />
      </div>
      <span className="flex flex-col gap-1">
        <span className="text-label font-medium text-muted-foreground">{name}</span>
        <span className="code-face inline-block min-w-[7ch] shrink-0 tabular-nums">{format(value)}</span>
      </span>
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Group exact mapped tokens so a quoted pattern is one focusable relationship, not fragments. */
function groupTokens(tokens: Tok[]): Tok[][] {
  const groups: Tok[][] = [];
  for (const token of tokens) {
    const previous = groups[groups.length - 1];
    if (token.lens && previous?.[0]?.lens === token.lens) previous.push(token);
    else groups.push([token]);
  }
  return groups;
}
