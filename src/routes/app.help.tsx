import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/help")({
  head: () => ({ meta: [{ title: "JamScript | Help" }] }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <main className="jam-help">
      <header className="jam-help-header">
        <Link to="/app" aria-label="Back to workspaces">
          <ArrowLeft size={18} /> Workspaces
        </Link>
        <img src="/brand/logo.svg" alt="JamScript" width={113} height={22} />
      </header>
      <div className="jam-help-content">
        <p className="jam-eyebrow">WORKBENCH GUIDE</p>
        <h1>Make music from code</h1>
        <p>
          Each browser workspace contains local JavaScript documents. Play evaluates the active
          document. Changes are saved in this browser as you work.
        </p>
        <section>
          <h2>Find your way around</h2>
          <ul>
            <li>
              <kbd>⌘/Ctrl P</kbd> opens files in the current workspace.
            </li>
            <li>
              <kbd>⌘/Ctrl Shift P</kbd> opens workbench commands.
            </li>
            <li>Use the Files, Inspector and Output buttons to show their panels.</li>
            <li>The Problems tab lists source syntax errors and jumps to their location.</li>
          </ul>
        </section>
        <section>
          <h2>Visual controls</h2>
          <p>
            JamScript scans the active source for supported Strudel chains and literal numeric
            values. The Inspector shows their knobs and sliders. Editing one updates that exact
            number in the code and can be undone in the editor. Computed expressions and ambiguous
            targets stay in code so a control cannot change the wrong value.
          </p>
        </section>
        <section>
          <h2>Browser storage</h2>
          <p>
            Workspaces and their documents live in this browser. A workspace link opens the same
            local workspace on this device and browser profile; it does not share the music with
            someone else.
          </p>
        </section>
        <section>
          <h2>Desktop Git and GitHub tokens</h2>
          <p>
            Git lives in the desktop app only (open a selected folder). The web workbench does not
            connect to GitHub remotes. To push and pull, paste a fine-grained personal access token
            in the desktop Git panel, or use device sign-in when a GitHub OAuth client id is
            configured.
          </p>
          <p>Fine-grained token settings:</p>
          <ul>
            <li>
              GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
              → Generate new token.
            </li>
            <li>Resource owner: your GitHub user (or the org that owns the song repos).</li>
            <li>Repository access: Only select repositories — pick the song repos you will use.</li>
            <li>
              Repository permissions → <strong>Contents: Read and write</strong> (clone private
              repos, push, and pull).
            </li>
            <li>Metadata: Read-only (GitHub requires this; leave it).</li>
            <li>Do not grant Administration, Workflows, or other permissions.</li>
          </ul>
          <p>
            JamScript stores the token in the OS keychain. It never force-pushes and only
            fast-forward pulls.
          </p>
        </section>
      </div>
    </main>
  );
}
