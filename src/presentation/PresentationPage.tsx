import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Expand,
  Grid2X2,
  Minimize,
  NotebookPen,
  Pause,
  Play,
  X,
} from "lucide-react";
import { pitchSlides } from "./deck";
import { PitchScene } from "./PitchScenes";
import "./presentation.css";

function slideFromHash() {
  if (typeof window === "undefined") return 0;
  const match = /^#slide-(\d+)$/.exec(window.location.hash);
  return match ? Math.min(pitchSlides.length - 1, Math.max(0, Number(match[1]) - 1)) : 0;
}

function clockTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PresentationPage() {
  const [index, setIndex] = useState(slideFromHash);
  const [showNotes, setShowNotes] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const reduced = useReducedMotion() ?? false;
  const root = useRef<HTMLElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const goTo = useCallback((next: number) => {
    setIndex(Math.min(pitchSlides.length - 1, Math.max(0, next)));
    setShowOverview(false);
  }, []);
  const next = useCallback(
    () => setIndex((value) => Math.min(pitchSlides.length - 1, value + 1)),
    [],
  );
  const previous = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#slide-${index + 1}`,
    );
  }, [index]);
  useEffect(() => {
    const onHash = () => setIndex(slideFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      // The page remains usable when a browser denies fullscreen.
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable=true]")
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        setShowOverview(false);
        setShowHelp(false);
        setShowNotes(false);
        setBlackout(false);
        return;
      }
      if (key === "f") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }
      if (key === "o") {
        event.preventDefault();
        setShowOverview((value) => !value);
        return;
      }
      if (key === "n") {
        event.preventDefault();
        setShowNotes((value) => !value);
        return;
      }
      if (key === "b" || key === ".") {
        event.preventDefault();
        setBlackout((value) => !value);
        return;
      }
      if (key === "?" || key === "h") {
        event.preventDefault();
        setShowHelp((value) => !value);
        return;
      }
      if (showOverview || showHelp || blackout) return;
      if (["arrowright", "arrowdown", "pagedown", " ", "enter", "mediatracknext"].includes(key)) {
        event.preventDefault();
        next();
      } else if (
        ["arrowleft", "arrowup", "pageup", "backspace", "mediatrackprevious"].includes(key)
      ) {
        event.preventDefault();
        previous();
      } else if (key === "home") {
        event.preventDefault();
        goTo(0);
      } else if (key === "end") {
        event.preventDefault();
        goTo(pitchSlides.length - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [blackout, goTo, next, previous, showHelp, showOverview, toggleFullscreen]);

  const slide = pitchSlides[index]!;
  return (
    <main className="pitch-root" ref={root} aria-label="JamScript stage presentation">
      <div className="pitch-ambient pitch-ambient-one" aria-hidden="true" />
      <div className="pitch-ambient pitch-ambient-two" aria-hidden="true" />
      <header className="pitch-header">
        <a href="/" className="pitch-brand" aria-label="JamScript website">
          <img src="/brand/app-icon.svg" alt="" />
          <span>JamScript</span>
          <i /> <small>THE STAGE PITCH</small>
        </a>
        <div className="pitch-header-right">
          <span>CODE → CONTROLS → MUSIC</span>
          <strong>
            {slide.number} <i>/</i> 07
          </strong>
        </div>
      </header>

      <div
        className="pitch-stage"
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (
            showOverview ||
            showHelp ||
            blackout ||
            (event.target as HTMLElement).closest("button, a")
          )
            return;
          if (window.getSelection()?.toString()) return;
          const x = event.clientX / window.innerWidth;
          if (x < 0.22) previous();
          else next();
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0];
          const start = touchStart.current;
          touchStart.current = null;
          if (!touch || !start || Math.abs(touch.clientY - start.y) > 80) return;
          const distance = touch.clientX - start.x;
          if (Math.abs(distance) < 55) return;
          suppressClick.current = true;
          if (distance < 0) next();
          else previous();
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={index}
            className="pitch-slide"
            aria-label={`Slide ${index + 1}: ${slide.chapter}`}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 62, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -54, filter: "blur(8px)" }}
            transition={{ duration: reduced ? 0.01 : 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pitch-copy">
              <motion.p
                className="pitch-eyebrow"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.14 }}
              >
                {slide.eyebrow}
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.22 }}
              >
                {slide.title}
                <br />
                <em>{slide.emphasis}</em>
              </motion.h1>
              <motion.p
                className="pitch-summary"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.34 }}
              >
                {slide.summary}
              </motion.p>
              <span className="pitch-copy-number">
                {slide.number} <span>—</span> {slide.chapter.toUpperCase()}
              </span>
            </div>
            <div className="pitch-visual">
              <PitchScene index={index} reduced={reduced} />
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="pitch-footer">
        <div className="pitch-progress" aria-label={`Slide ${index + 1} of ${pitchSlides.length}`}>
          <span style={{ width: `${((index + 1) / pitchSlides.length) * 100}%` }} />
        </div>
        <div className="pitch-footer-inner">
          <div className="pitch-footer-left">
            <span className="pitch-timer">{clockTime(seconds)}</span>
            <button
              type="button"
              onClick={() => setTimerRunning((value) => !value)}
              aria-label={timerRunning ? "Pause presentation timer" : "Start presentation timer"}
              title={timerRunning ? "Pause timer" : "Start timer"}
            >
              {timerRunning ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <span className="pitch-footer-hint">← → / Space / clicker to navigate</span>
          </div>
          <div className="pitch-footer-actions">
            <button
              type="button"
              onClick={() => setShowNotes((value) => !value)}
              aria-pressed={showNotes}
              title="Speaker notes (N)"
            >
              <NotebookPen size={16} />
              <span>Notes</span>
            </button>
            <button
              type="button"
              onClick={() => setShowOverview((value) => !value)}
              aria-pressed={showOverview}
              title="Slide overview (O)"
            >
              <Grid2X2 size={16} />
              <span>Overview</span>
            </button>
            <button type="button" onClick={() => void toggleFullscreen()} title="Fullscreen (F)">
              {fullscreen ? <Minimize size={16} /> : <Expand size={16} />}
              <span>{fullscreen ? "Exit full" : "Full screen"}</span>
            </button>
            <button
              type="button"
              onClick={previous}
              disabled={index === 0}
              aria-label="Previous slide"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={index === pitchSlides.length - 1}
              aria-label="Next slide"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showNotes && (
          <motion.aside
            className="pitch-notes"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: reduced ? 0 : 0.35 }}
            aria-label="Speaker notes"
          >
            <div className="pitch-overlay-heading">
              <span>SPEAKER NOTES · {slide.number}</span>
              <button type="button" onClick={() => setShowNotes(false)} aria-label="Close notes">
                <X size={18} />
              </button>
            </div>
            <h2>{slide.chapter}</h2>
            <p className="pitch-note-cue">STAGE CUE · {slide.cue}</p>
            {slide.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </motion.aside>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showOverview && (
          <motion.div
            className="pitch-overlay pitch-overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Slide overview"
          >
            <div className="pitch-overlay-heading">
              <span>ALL SEVEN MOMENTS</span>
              <button
                type="button"
                onClick={() => setShowOverview(false)}
                aria-label="Close overview"
              >
                <X size={20} />
              </button>
            </div>
            <div className="pitch-overview-grid">
              {pitchSlides.map((item, itemIndex) => (
                <button
                  type="button"
                  className={itemIndex === index ? "is-active" : ""}
                  onClick={() => goTo(itemIndex)}
                  key={item.number}
                >
                  <span>
                    {item.number} / {item.chapter}
                  </span>
                  <strong>
                    {item.title} {item.emphasis}
                  </strong>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className="pitch-overlay pitch-help"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Presentation controls"
          >
            <div className="pitch-overlay-heading">
              <span>STAGE CONTROLS</span>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="Close controls">
                <X size={20} />
              </button>
            </div>
            <h2>Run the room, your way.</h2>
            <dl>
              <div>
                <dt>→ / Space / Enter / Page Down</dt>
                <dd>Next slide</dd>
              </div>
              <div>
                <dt>← / Backspace / Page Up</dt>
                <dd>Previous slide</dd>
              </div>
              <div>
                <dt>F</dt>
                <dd>Fullscreen</dd>
              </div>
              <div>
                <dt>O</dt>
                <dd>Slide overview</dd>
              </div>
              <div>
                <dt>N</dt>
                <dd>Speaker notes</dd>
              </div>
              <div>
                <dt>B or .</dt>
                <dd>Black screen</dd>
              </div>
              <div>
                <dt>Home / End</dt>
                <dd>First / last slide</dd>
              </div>
              <div>
                <dt>Click / swipe</dt>
                <dd>Advance or go back</dd>
              </div>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
      {blackout && (
        <button
          type="button"
          className="pitch-blackout"
          onClick={() => setBlackout(false)}
          aria-label="Resume presentation"
        >
          Press B or click to return
        </button>
      )}
    </main>
  );
}
