import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import "@/marketing/docs.css";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "JamScript Docs | Get started" },
      {
        name: "description",
        content:
          "Get started with JamScript workspaces, Strudel playback, BPM, source controls and audio export.",
      },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <div className="jam-docs">
      <header className="jam-docs-header">
        <Link to="/" className="jam-docs-brand" aria-label="JamScript home">
          <img src="/brand/logo.svg" alt="JamScript" width="148" height="29" />
        </Link>
        <span>Documentation</span>
        <Link to="/app" className="jam-docs-open">
          Open app <ArrowRight size={15} />
        </Link>
      </header>
      <div className="jam-docs-layout">
        <nav className="jam-docs-nav" aria-label="Documentation sections">
          <span>GET STARTED</span>
          <a href="#first-session">Your first session</a>
          <a href="#workspaces">Workspaces and files</a>
          <a href="#tempo">Tempo and playback</a>
          <a href="#controls">Controls and mixing</a>
          <a href="#export">Export and history</a>
          <a href="#shortcuts">Keyboard shortcuts</a>
          <a href="#sharing">Sharing status</a>
        </nav>
        <main className="jam-docs-main">
          <Link to="/" className="jam-docs-back">
            <ArrowLeft size={14} /> Back to JamScript
          </Link>
          <p className="jam-docs-eyebrow">THE WORKBENCH GUIDE</p>
          <h1>Make a little noise.</h1>
          <p className="jam-docs-lead">
            JamScript lets you write Strudel music, hear it live, and shape supported parts of the
            source with visual controls. The code in the editor stays in charge.
          </p>
          <section id="first-session">
            <span className="jam-docs-number">01 / START</span>
            <h2>Your first session</h2>
            <ol>
              <li>
                <Link to="/app">Open the browser workbench</Link> and create a workspace.
              </li>
              <li>
                Create a document, or choose the Night bus example from the workspace chooser.
              </li>
              <li>
                Type <code>s("bd ~ sd ~")</code> and press Play. Stop all audio from the transport
                at any time.
              </li>
              <li>
                Edit a supported step or parameter, then use the editor’s undo command to reverse
                it.
              </li>
            </ol>
          </section>
          <section id="workspaces">
            <span className="jam-docs-number">02 / KEEP</span>
            <h2>Workspaces and files</h2>
            <p>
              Browser workspaces and documents are stored in this browser’s IndexedDB. They autosave
              locally and do not need an account. Clearing site data removes local workspaces; a
              workspace URL does not share your music with another person.
            </p>
            <p>
              The desktop edition can open a selected folder and save files to disk. Browser
              workspaces do not have direct filesystem access. Public desktop installers will appear
              on the
              <Link to="/" hash="download">
                {" "}
                Download section
              </Link>{" "}
              after they are published.
            </p>
          </section>
          <section id="tempo">
            <span className="jam-docs-number">03 / HEAR</span>
            <h2>Tempo and playback</h2>
            <p>
              Musicians can enter BPM in the transport. Strudel uses cycles per second (CPS). With
              the default four beats per cycle, <code>120 BPM = 0.5 CPS</code>. A BPM edit changes a
              supported, unambiguous <code>setcps()</code> or <code>setcpm()</code> call in the
              active document. If tempo is computed or ambiguous, edit it in code.
            </p>
            <p>
              Play evaluates the active document. Stop all audio is available even if an evaluation
              fails or the normal transport state has fallen out of sync. The Output panel reports
              playback and source errors; the meter and spectrum respond to real audio output.
            </p>
          </section>
          <section id="controls">
            <span className="jam-docs-number">04 / SHAPE</span>
            <h2>Controls and mixing</h2>
            <p>
              Rhythm cells and Inspector controls appear for syntax JamScript can locate safely.
              These controls patch exact source ranges and share the editor’s undo history. Nested,
              computed or ambiguous expressions may remain code-only. Select a track to inspect its
              supported parameters; use Solo to hear a supported track on its own.
            </p>
            <p>
              Master and track levels are runtime mix controls. Some Strudel compositions apply
              effects after a whole stack; JamScript keeps that routing intact and omits individual
              faders when splitting the stack would change the sound.
            </p>
          </section>
          <section id="export">
            <span className="jam-docs-number">05 / TAKE IT OUT</span>
            <h2>Export and history</h2>
            <p>
              Export the active main flow as WAV or MP3 from the workbench. Local Takes record
              successful evaluations per document, so you can compare, audition, or restore an
              earlier source snapshot. A Take is local history, not a shared version.
            </p>
          </section>
          <section id="shortcuts">
            <span className="jam-docs-number">06 / NAVIGATE</span>
            <h2>Keyboard shortcuts</h2>
            <dl>
              <div>
                <dt>Ctrl/⌘ F</dt>
                <dd>Find in the active music document; Enter moves to the next match</dd>
              </div>
              <div>
                <dt>Ctrl/⌘ P</dt>
                <dd>Quick Open in the current workspace</dd>
              </div>
              <div>
                <dt>Ctrl/⌘ Shift P</dt>
                <dd>Workbench command palette</dd>
              </div>
              <div>
                <dt>Ctrl/⌘ Z</dt>
                <dd>Undo source or visual-control edit</dd>
              </div>
            </dl>
          </section>
          <section id="sharing">
            <span className="jam-docs-number">07 / CONNECT</span>
            <h2>Sharing status</h2>
            <p>
              Account-backed sharing requires the connected workspace services and permissions.
              Local browser workspaces remain private to this browser. When sharing is available,
              JamScript publishes only files you explicitly select, not your local folder.
            </p>
            <a
              href="https://strudel.cc/learn/"
              target="_blank"
              rel="noreferrer"
              className="jam-docs-external"
            >
              Learn the Strudel language <ExternalLink size={14} />
            </a>
          </section>
        </main>
      </div>
    </div>
  );
}
