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
          <a href="#samples">Samples</a>
          <a href="#assistant">Assistant</a>
          <a href="#sharing">Sharing and collaboration</a>
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
              workspaces do not have direct filesystem access. Desktop installers for Windows, macOS
              (Apple Silicon) and Linux are on the
              <Link to="/" hash="download">
                {" "}
                Download section
              </Link>
              . Current builds are not code-signed or notarized, so your operating system may show a
              security warning on first launch.
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
          <section id="samples">
            <span className="jam-docs-number">07 / SOUND</span>
            <h2>Samples</h2>
            <p>
              Press the <strong>Sounds</strong> button (the sound-wave icon in the side bar, or the
              bottom bar on phones), or open the <strong>Samples</strong> tab in the bottom panel.
              Every sound you can use appears there. Search by name, pick a drum machine from{" "}
              <strong>Bank</strong>, and use <strong>Show all</strong> to see the whole list. Tap a
              pad to hear it without stopping your song, then copy its code, such as{" "}
              <code>s("bd")</code>, into your song. Songs that load their own sample packs add them
              after you press Play once; use <strong>Refresh</strong> to see them.
            </p>
            <p>
              <strong>Replace selected sound</strong> only edits a single literal sound selected in
              the editor, and you can undo it. It does not rewrite pattern strings or banked
              expressions. Sample packs are downloaded from their hosts on first use and cached in
              your browser, so the first play of a new song can start a little later than the next.
            </p>
          </section>
          <section id="assistant">
            <span className="jam-docs-number">08 / ASK</span>
            <h2>Assistant</h2>
            <p>
              The assistant panel has two modes. <strong>Ask</strong> explains code and returns
              examples you can copy; it never writes to your files. <strong>Edit</strong> proposes
              changes to existing files for you to review, and nothing is applied until you accept
              it. Edits are checked against the current source, so a proposal made for an older
              version is not applied silently.
            </p>
            <p>
              Viewers of a shared project can use Ask, but Edit needs editing access. The assistant
              appears only when it is configured for the deployment, and it can be unavailable if
              the AI service is out of credit or down.
            </p>
          </section>
          <section id="sharing">
            <span className="jam-docs-number">09 / CONNECT</span>
            <h2>Sharing and collaboration</h2>
            <p>
              Sign in to create a shared project. Local browser workspaces stay private to your
              browser; JamScript shares only the files you choose, not your local folder. A project
              owner can invite people by email as editors or viewers. If email cannot be sent, you
              get a link to share instead. Invitations expire after seven days and the owner can
              revoke them.
            </p>
            <p>
              Owners can see members and pending invitations and remove members. Editors work in the
              same document live, and connected people appear as coloured avatars and tab dots.
              Viewers have read-only access. Shared documents sync through the live room, and
              someone else’s edits never start playback on your machine.
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
