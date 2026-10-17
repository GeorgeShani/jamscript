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
      </div>
    </main>
  );
}
