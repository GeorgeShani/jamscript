import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  FolderOpen,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { DesktopDownloads } from "./DesktopDownloads";
import "./marketing.css";

const code = [
  {
    number: "01",
    content: (
      <>
        <span className="comment">// a groove starts here</span>
      </>
    ),
  },
  {
    number: "02",
    content: (
      <>
        <span className="fn">setcps</span>(<span className="number">0.5</span>)
      </>
    ),
  },
  {
    number: "03",
    content: (
      <>
        <span className="fn">stack</span>(
      </>
    ),
  },
  {
    number: "04",
    content: (
      <>
        &nbsp; <span className="fn">s</span>(<span className="string">"bd ~ bd [~ bd]"</span>)
      </>
    ),
  },
  {
    number: "05",
    content: (
      <>
        &nbsp;&nbsp; .<span className="fn">gain</span>(<span className="number">0.8</span>),
      </>
    ),
  },
  {
    number: "06",
    content: (
      <>
        &nbsp; <span className="fn">s</span>(<span className="string">"~ hh ~ hh"</span>)
      </>
    ),
  },
  {
    number: "07",
    content: (
      <>
        &nbsp;&nbsp; .<span className="fn">room</span>(<span className="number">0.2</span>)
      </>
    ),
  },
  { number: "08", content: <> )</> },
];

export function MarketingHome() {
  const site = useRef<HTMLDivElement>(null);
  const [previewTake, setPreviewTake] = useState(0);

  useEffect(() => {
    const root = site.current;
    if (
      !root ||
      !window.IntersectionObserver ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const sections = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.08 },
    );
    root.classList.add("jam-motion-ready");
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="jam-site" ref={site}>
      <div className="jam-site-scroll-progress" aria-hidden="true" />
      <header className="jam-site-header">
        <Link to="/" aria-label="JamScript home" className="jam-site-logo">
          <img src="/brand/logo.svg" alt="JamScript" width="162" height="32" />
        </Link>
        <nav aria-label="Main navigation">
          <a href="#workbench">Workbench</a>
          <a href="#features">Features</a>
          <a href="#download">Download</a>
          <a href="#roadmap">Roadmap</a>
          <Link to="/docs">Docs</Link>
        </nav>
        <Link to="/app" className="jam-site-nav-cta">
          Open app <ArrowUpRight size={15} />
        </Link>
      </header>

      <main>
        <section className="jam-site-hero" aria-labelledby="site-title">
          <div className="jam-site-hero-copy">
            <p className="jam-site-kicker">
              <span /> A MUSIC IDE FOR THE BROWSER
            </p>
            <h1 id="site-title">
              Make music.
              <br />
              <em>Stay in your flow.</em>
            </h1>
            <p className="jam-site-lead">
              Write Strudel, hear it immediately, and shape the sound with controls connected to
              your code. Your project lives in a focused workspace, ready whenever inspiration
              returns.
            </p>
            <div className="jam-site-actions">
              <Link to="/app" className="jam-site-primary">
                Open JamScript <ArrowRight size={18} />
              </Link>
              <a href="#workbench" className="jam-site-secondary">
                Explore the workbench <ArrowRight size={16} />
              </a>
            </div>
            <p className="jam-site-hero-note">
              Start in your browser. No account required for local workspaces.
            </p>
          </div>
          <div
            key={previewTake}
            className="jam-site-preview"
            aria-label="Animated illustration of the JamScript workbench"
          >
            <div className="jam-site-preview-titlebar">
              <span className="jam-site-preview-mark">
                <img src="/brand/mark.svg" alt="" width="19" height="19" /> JamScript
              </span>
              <button
                type="button"
                className="jam-site-preview-replay"
                onClick={() => setPreviewTake((take) => take + 1)}
                aria-label="Replay workbench illustration"
              >
                <RotateCcw size={12} /> Replay
              </button>
              <span className="jam-site-preview-bpm">
                120 BPM <Play size={12} fill="currentColor" />
              </span>
            </div>
            <div className="jam-site-preview-main">
              <aside>
                <span>FILES</span>
                <strong>▾ &nbsp; My session</strong>
                <small>♫ &nbsp; groove.js</small>
                <small>♫ &nbsp; sketches.js</small>
              </aside>
              <div className="jam-site-preview-editor">
                <div className="jam-site-preview-tab">
                  groove.js <span>×</span>
                </div>
                <div className="jam-site-preview-code">
                  {code.map((line) => (
                    <div key={line.number}>
                      <span className="line-no">{line.number}</span>
                      <code>{line.content}</code>
                    </div>
                  ))}
                </div>
                <div className="jam-site-preview-lens">
                  <span>bd</span>
                  <b>●</b>
                  <i />
                  <b>●</b>
                  <i />
                  <b>●</b>
                  <i />
                  <b>●</b>
                  <i />
                </div>
                <div className="jam-site-preview-lens hats">
                  <span>hh</span>
                  <i />
                  <b>●</b>
                  <i />
                  <b>●</b>
                  <i />
                  <b>●</b>
                  <i />
                  <b>●</b>
                </div>
              </div>
              <aside className="jam-site-preview-inspector">
                <span>INSPECTOR</span>
                <strong>Drums</strong>
                <small>Gain</small>
                <div className="jam-site-preview-slider">
                  <i />
                </div>
                <small>Room</small>
                <div className="jam-site-preview-slider room">
                  <i />
                </div>
              </aside>
            </div>
            <div className="jam-site-preview-bottom">
              OUTPUT <span>Code is the source. Controls write back to it.</span>
            </div>
            <div className="jam-site-preview-status">
              Strudel · JavaScript <span>Product illustration</span>
            </div>
          </div>
        </section>

        <div className="jam-site-band" aria-label="Core workflow">
          <span>WRITE THE PATTERN</span>
          <b>→</b>
          <span>SHAPE THE SOUND</span>
          <b>→</b>
          <span>HEAR THE CHANGE</span>
        </div>

        <section className="jam-site-section jam-site-workbench" id="workbench">
          <div className="jam-site-section-heading" data-reveal>
            <p className="jam-site-kicker">ONE PLACE TO MAKE MUSIC</p>
            <h2>An editor built around the moment you press play.</h2>
            <p>
              Files, sound controls, transport and output stay close to the code. Move from an idea
              to a playable session without changing tools.
            </p>
          </div>
          <div className="jam-site-feature-grid" id="features">
            <article data-reveal>
              <span className="jam-site-feature-icon">
                <AudioLines size={21} />
              </span>
              <small>01 / PLAY</small>
              <h3>Hear your code</h3>
              <p>
                Run the active Strudel document, set tempo in BPM, and inspect the real output
                through a level meter and spectrum.
              </p>
            </article>
            <article data-reveal>
              <span className="jam-site-feature-icon">
                <SlidersHorizontal size={21} />
              </span>
              <small>02 / SHAPE</small>
              <h3>Touch the source</h3>
              <p>
                Use rhythm and parameter controls for supported expressions. Every edit writes back
                to the document and shares its undo history.
              </p>
            </article>
            <article data-reveal>
              <span className="jam-site-feature-icon">
                <FolderOpen size={21} />
              </span>
              <small>03 / KEEP</small>
              <h3>Stay organized</h3>
              <p>
                Create browser workspaces, keep multiple documents open, and return to your sessions
                with local autosave.
              </p>
            </article>
          </div>
        </section>

        <section className="jam-site-section jam-site-mix">
          <div data-reveal>
            <p className="jam-site-kicker">MIX, THEN TAKE IT WITH YOU</p>
            <h2>From a sketch to a file you can share.</h2>
            <p>
              Solo a track to hear its part, balance tracks with individual levels, then export the
              main flow as WAV or MP3.
            </p>
            <Link to="/app" className="jam-site-text-link">
              Start a session <ArrowRight size={17} />
            </Link>
          </div>
          <div className="jam-site-mix-visual" aria-hidden="true" data-reveal>
            <div>
              <span>MASTER</span>
              <i style={{ height: "62%" }} />
              <b>0.82</b>
            </div>
            <div>
              <span>DRUMS</span>
              <i style={{ height: "83%" }} />
              <b>0.90</b>
            </div>
            <div>
              <span>BASS</span>
              <i style={{ height: "48%" }} />
              <b>0.68</b>
            </div>
            <div>
              <span>CHORDS</span>
              <i style={{ height: "70%" }} />
              <b>0.76</b>
            </div>
          </div>
        </section>

        <DesktopDownloads />

        <section className="jam-site-section jam-site-roadmap" id="roadmap">
          <div data-reveal>
            <p className="jam-site-kicker">WHAT COMES NEXT</p>
            <h2>Growing into a full music IDE.</h2>
            <p>
              The browser workbench is available now. Desktop builds and connected services are
              being tested before their public release.
            </p>
          </div>
          <ul data-reveal>
            <li>
              <span>01</span>
              <div>
                <strong>Desktop edition</strong>
                <p>
                  Native folder workflows are implemented; public installers and cross-platform
                  verification are next.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Shared workspaces</strong>
                <p>Invitations and shared source are being integrated and tested together.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Music-aware assistance</strong>
                <p>Offline Strudel IntelliSense and reviewed, service-backed AI proposals.</p>
              </div>
            </li>
          </ul>
        </section>

        <section className="jam-site-section jam-site-faq" id="questions">
          <div className="jam-site-section-heading" data-reveal>
            <p className="jam-site-kicker">GOOD TO KNOW</p>
            <h2>Before you press play.</h2>
          </div>
          <div className="jam-site-faq-list" data-reveal>
            <details>
              <summary>
                Where are my projects saved?<span aria-hidden="true">+</span>
              </summary>
              <p>
                Browser workspaces are stored in this browser’s IndexedDB and autosave locally.
                Clearing site data removes them. Account-backed sync is planned.
              </p>
            </details>
            <details>
              <summary>
                Do I need an account or Git?<span aria-hidden="true">+</span>
              </summary>
              <p>
                No. You can create and play local browser workspaces without either. Git is an
                optional desktop tool.
              </p>
            </details>
            <details>
              <summary>
                Can I edit Strudel code directly?<span aria-hidden="true">+</span>
              </summary>
              <p>
                Yes. Code is the source of every session. Visual controls currently edit selected
                rhythm tokens and numeric gain, room and filter values; other expressions stay
                editable in code.
              </p>
            </details>
            <details>
              <summary>
                Is the desktop app available now?<span aria-hidden="true">+</span>
              </summary>
              <p>
                The native desktop shell exists, but no public installers have been published yet.
                The Download section checks for real release files before showing links.
              </p>
            </details>
          </div>
        </section>

        <section className="jam-site-final" aria-labelledby="jam-site-final-title">
          <div className="jam-site-final-inner" data-reveal>
            <div className="jam-site-final-copy">
              <p className="jam-site-kicker">
                <span /> YOUR NEXT SESSION STARTS HERE
              </p>
              <h2 id="jam-site-final-title">
                Give the idea
                <br />
                <em>somewhere to go.</em>
              </h2>
              <p className="jam-site-final-lead">
                Start with one sound. Build the rest in a workspace where code, controls, and
                playback stay together.
              </p>
              <div className="jam-site-final-actions">
                <Link to="/app" className="jam-site-primary">
                  Open the workbench <ArrowRight size={18} />
                </Link>
                <span>Browser workspace · No setup required</span>
              </div>
            </div>
            <div className="jam-site-final-art" aria-hidden="true">
              <div className="jam-site-final-art-head">
                <span>
                  <i /> NEW SESSION
                </span>
                <span>120 BPM</span>
              </div>
              <div className="jam-site-final-art-grid">
                {[
                  [1, 0, 0, 0, 1, 0, 0, 0],
                  [0, 0, 1, 0, 0, 0, 1, 0],
                  [1, 1, 1, 1, 1, 1, 1, 1],
                  [0, 0, 0, 1, 0, 0, 0, 1],
                ].map((steps, row) => (
                  <div className="jam-site-final-art-row" key={row}>
                    <span>{["KICK", "SNARE", "HATS", "BASS"][row]}</span>
                    {steps.map((active, step) => (
                      <i className={active ? "is-on" : ""} key={step} />
                    ))}
                  </div>
                ))}
                <div className="jam-site-final-playhead" />
              </div>
              <div className="jam-site-final-art-foot">
                <span>01 — 08</span>
                <span>
                  MAKE IT YOURS <ArrowRight size={13} />
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="jam-site-footer">
        <img src="/brand/logo.svg" alt="JamScript" width="140" height="27" />
        <p>
          Built on{" "}
          <a href="https://strudel.cc/" target="_blank" rel="noreferrer">
            Strudel <ArrowUpRight size={12} />
          </a>
          . <Link to="/docs">Docs</Link>. <a href="/licenses/THIRD_PARTY_NOTICES.txt">Licenses</a>
        </p>
        <span>© {new Date().getFullYear()} JamScript</span>
      </footer>
    </div>
  );
}
