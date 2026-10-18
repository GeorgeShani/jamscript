import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDownRight,
  Code2,
  LockKeyhole,
  MousePointer2,
  Music2,
  SlidersVertical,
} from "lucide-react";

const rise = { hidden: { opacity: 0, y: 26 }, shown: { opacity: 1, y: 0 } };

function SceneLabel({ children }: { children: string }) {
  return <span className="pitch-scene-label">{children}</span>;
}

function BeatGrid({ active, reduced = false }: { active: number[]; reduced?: boolean }) {
  return (
    <div className="pitch-beat-grid" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <motion.span
          key={index}
          className={active.includes(index) ? "is-on" : ""}
          animate={
            reduced || !active.includes(index)
              ? {}
              : {
                  scale: [1, 1.13, 1],
                  filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"],
                }
          }
          transition={{ duration: 1.7, repeat: Infinity, delay: index * 0.12 }}
        />
      ))}
    </div>
  );
}

function CodeCard({
  children,
  title = "session.js",
  compact = false,
}: {
  children: React.ReactNode;
  title?: string;
  compact?: boolean;
}) {
  return (
    <div className={`pitch-code-card${compact ? " is-compact" : ""}`}>
      <div className="pitch-code-title">
        <Code2 size={15} aria-hidden="true" /> {title}
        <span>● ● ●</span>
      </div>
      <div className="pitch-code-lines">{children}</div>
    </div>
  );
}

function Line({
  number,
  indent = 0,
  children,
}: {
  number: number;
  indent?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="pitch-code-line">
      <span className="pitch-line-number">{number}</span>
      <code style={{ paddingInlineStart: `${indent}ch` }}>{children}</code>
    </div>
  );
}

function Knob({ shifted = false }: { shifted?: boolean }) {
  return (
    <div className="pitch-knob" aria-hidden="true">
      <motion.span
        animate={{ rotate: shifted ? 48 : -30 }}
        transition={{ type: "spring", stiffness: 150, damping: 16 }}
      />
    </div>
  );
}

function ProblemScene({ reduced }: { reduced: boolean }) {
  return (
    <div className="pitch-scene pitch-scene-problem">
      <SceneLabel>CONCEPT ILLUSTRATION · THE INTERRUPTED FLOW</SceneLabel>
      <motion.div variants={rise} className="pitch-scene-float pitch-search-chip">
        <MousePointer2 size={16} aria-hidden="true" /> find the right hit…
      </motion.div>
      <CodeCard>
        <Line number={1}>
          <span className="pitch-syn-muted">// the idea is already playing</span>
        </Line>
        <Line number={2}>
          setcps(<span className="pitch-syn-number">0.6</span>)
        </Line>
        <Line number={3}>stack(</Line>
        <Line number={4} indent={2}>
          s(<span className="pitch-syn-string">"bd ~ sd ~ bd bd sd ~"</span>),
        </Line>
        <Line number={5} indent={2}>
          s(<span className="pitch-syn-string">"hh hh hh hh"</span>).gain(
          <span className="pitch-syn-number">0.6</span>),
        </Line>
        <Line number={6} indent={2}>
          note(<span className="pitch-syn-string">"c2 ~ eb2 g1"</span>).lpf(
          <span className="pitch-syn-number">1200</span>)
        </Line>
        <Line number={7}>)</Line>
      </CodeCard>
      <motion.div
        className="pitch-scan-line"
        animate={reduced ? {} : { top: ["25%", "76%", "25%"] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="pitch-problem-footer">
        <span className="pitch-pulse-dot" /> IDEA PLAYING <span>→</span> CURSOR HUNTING
      </div>
    </div>
  );
}

function QuestionScene({ reduced }: { reduced: boolean }) {
  return (
    <div className="pitch-scene pitch-scene-question">
      <SceneLabel>CONCEPT ILLUSTRATION · TWO WAYS IN</SceneLabel>
      <motion.div className="pitch-question-code" variants={rise}>
        <CodeCard compact>
          <Line number={1}>
            drums: s(<span className="pitch-syn-string">"bd ~ sd ~"</span>)
          </Line>
          <Line number={2} indent={2}>
            .gain(<span className="pitch-syn-number">0.50</span>)
          </Line>
        </CodeCard>
      </motion.div>
      <motion.div
        className="pitch-question-controls"
        initial={{ opacity: 0, x: 48 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: reduced ? 0 : 0.35, duration: reduced ? 0 : 0.6 }}
      >
        <div className="pitch-control-card">
          <span>RHYTHM</span>
          <BeatGrid active={[0, 2]} reduced={reduced} />
        </div>
        <div className="pitch-control-card pitch-control-gain">
          <span>GAIN</span>
          <Knob />
          <strong>0.50</strong>
        </div>
      </motion.div>
      <motion.div
        className="pitch-question-connector"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: reduced ? 0 : 0.7, duration: reduced ? 0 : 0.7 }}
      />
    </div>
  );
}

function IdeaScene({ reduced }: { reduced: boolean }) {
  return (
    <div className="pitch-scene pitch-scene-idea">
      <SceneLabel>CONCEPT ILLUSTRATION · ONE SOURCE</SceneLabel>
      <div className="pitch-idea-source">
        <span>SOURCE</span>
        <CodeCard compact>
          <Line number={1}>
            s(<span className="pitch-syn-string">"bd ~ sd ~"</span>).gain(
            <span className="pitch-syn-number">0.50</span>)
          </Line>
        </CodeCard>
      </div>
      <svg
        className="pitch-idea-links"
        viewBox="0 0 600 340"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <motion.path
          d="M300 134 C300 230 145 180 145 258"
          fill="none"
          stroke="var(--pitch-cyan)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0 : 1.2, delay: reduced ? 0 : 0.3 }}
        />
        <motion.path
          d="M300 134 C300 230 455 180 455 258"
          fill="none"
          stroke="var(--pitch-amber)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0 : 1.2, delay: reduced ? 0 : 0.45 }}
        />
      </svg>
      <div className="pitch-idea-nodes">
        <motion.div variants={rise} className="pitch-idea-node">
          <span>01 / TOUCH THE BEAT</span>
          <BeatGrid active={[0, 2]} reduced={reduced} />
        </motion.div>
        <motion.div variants={rise} className="pitch-idea-node">
          <span>02 / SHAPE THE SOUND</span>
          <div>
            <Knob />
            <strong>0.50</strong>
          </div>
        </motion.div>
      </div>
      <p className="pitch-one-song">
        ONE SONG <span>·</span> TWO WAYS TO PLAY
      </p>
    </div>
  );
}

function SolutionScene({ reduced }: { reduced: boolean }) {
  const [shifted, setShifted] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setShifted((value) => !value), 2200);
    return () => window.clearInterval(timer);
  }, [reduced]);
  return (
    <div className="pitch-scene pitch-scene-solution">
      <SceneLabel>CONCEPT ILLUSTRATION · LINKED EDIT</SceneLabel>
      <div className="pitch-solution-top">
        <span>JAMSCRIPT / LIVE LENSES</span>
        <span className="pitch-live-indicator">
          <i /> IN SYNC
        </span>
      </div>
      <CodeCard title="my-beat.js">
        <Line number={1}>
          drums: s(<span className="pitch-syn-string">"bd {shifted ? "bd" : "~"} sd ~"</span>)
        </Line>
        <Line number={2} indent={2}>
          .gain(
          <motion.span
            className="pitch-syn-number pitch-changing-value"
            key={String(shifted)}
            initial={{ opacity: 0.25, y: -9 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {shifted ? "0.75" : "0.50"}
          </motion.span>
          )
        </Line>
      </CodeCard>
      <div className="pitch-solution-controls">
        <div>
          <span>DRUMS · STEPS</span>
          <BeatGrid active={shifted ? [0, 1, 2] : [0, 2]} reduced={reduced} />
        </div>
        <div>
          <span>GAIN</span>
          <Knob shifted={shifted} />
          <strong>{shifted ? "0.75" : "0.50"}</strong>
        </div>
      </div>
      <div className="pitch-solution-caption">
        <ArrowDownRight size={19} /> Only the linked characters change.
      </div>
    </div>
  );
}

function SafetyScene({ reduced }: { reduced: boolean }) {
  return (
    <div className="pitch-scene pitch-scene-safety">
      <SceneLabel>CONCEPT ILLUSTRATION · SAFE BY DESIGN</SceneLabel>
      <motion.div variants={rise} className="pitch-safety-card is-simple">
        <span className="pitch-safety-tag">SUPPORTED</span>
        <code>s("bd ~ sd ~")</code>
        <BeatGrid active={[0, 2]} reduced={reduced} />
        <strong>Ready to play by hand</strong>
      </motion.div>
      <motion.div variants={rise} className="pitch-safety-card is-complex">
        <span className="pitch-safety-tag">COMPLEX EXPRESSION</span>
        <code>n("[0 &lt;1 3&gt;]*&lt;2!3 4&gt;")</code>
        <div className="pitch-safety-locked">
          <LockKeyhole size={22} aria-hidden="true" /> Edit this pattern in code
        </div>
        <strong>Never rewrite by guessing</strong>
      </motion.div>
    </div>
  );
}

function AudienceScene({ reduced }: { reduced: boolean }) {
  return (
    <div className="pitch-scene pitch-scene-audience">
      <SceneLabel>CONCEPT ILLUSTRATION · SHARED SONG</SceneLabel>
      <div className="pitch-audience-people">
        <motion.div variants={rise} className="pitch-person is-code">
          <span>
            <Code2 size={20} /> THE CODER
          </span>
          <p>“I’ll write the pattern.”</p>
          <code>s("bd ~ sd ~")</code>
        </motion.div>
        <motion.div variants={rise} className="pitch-person is-controls">
          <span>
            <SlidersVertical size={20} /> THE MUSICIAN
          </span>
          <p>“I’ll shape the sound.”</p>
          <Knob shifted />
        </motion.div>
      </div>
      <div className="pitch-audience-track">
        <Music2 size={20} aria-hidden="true" />
        <span>ONE SHARED SONG</span>
        <motion.i
          animate={reduced ? {} : { x: [0, 360, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function ClosingScene({ reduced }: { reduced: boolean }) {
  return (
    <div className="pitch-scene pitch-scene-closing">
      <SceneLabel>CONCEPT ILLUSTRATION · JAMSCRIPT</SceneLabel>
      <div className="pitch-closing-orbit" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <motion.span
            key={index}
            animate={reduced ? {} : { scale: [0.8, 1.18, 0.8], opacity: [0.18, 0.5, 0.18] }}
            transition={{ duration: 3.8, repeat: Infinity, delay: index * 0.25 }}
          />
        ))}
      </div>
      <motion.img
        src="/brand/app-icon.svg"
        alt=""
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.7 }}
      />
      <strong>JamScript</strong>
      <p>CODE IS THE SOURCE. LENSES ARE HOW YOU PLAY IT.</p>
    </div>
  );
}

export function PitchScene({ index, reduced }: { index: number; reduced: boolean }) {
  const scenes = [
    ProblemScene,
    QuestionScene,
    IdeaScene,
    SolutionScene,
    SafetyScene,
    AudienceScene,
    ClosingScene,
  ];
  const Scene = scenes[index] ?? ClosingScene;
  return (
    <motion.div
      className="pitch-scene-frame"
      initial="hidden"
      animate="shown"
      transition={{ staggerChildren: reduced ? 0 : 0.12 }}
    >
      <Scene reduced={reduced} />
    </motion.div>
  );
}
