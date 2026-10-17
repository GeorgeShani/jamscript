# Product

<!-- impeccable:product-schema 1 -->

## Platform

Desktop music IDE for Windows, macOS and Linux, with a collaborative browser companion. The current implementation is a browser editor; native packaging and connected services are planned.

## Stack

Current: TanStack Start in SPA mode on Cloudflare Workers, React 19, TypeScript, Tailwind v4, shadcn/ui, CodeMirror 6, Strudel, and selected audiocn controls. Local Lovable build and reporting code has been removed; disconnect the external Lovable GitHub link before pushing this change.

Chosen additions: Tauri v2 for desktop; Supabase for email authentication, workspace metadata and invitations; Liveblocks/Yjs for shared documents; an owned Strudel language service; Gemini behind a private backend endpoint. These are product decisions, not installed capabilities. See IMPLEMENTATION_PLAN.md for delivery order.

## Users

Developers who jam and musicians comfortable exploring code. Someone should be able to make and save music without knowing Git or owning a GitHub account. Shared projects should work across desktop and browser participants. JamScript owns workspace management; Git is an optional desktop enhancement.

## Product Purpose

Code is the source. Lenses are how you play it. JamScript keeps Strudel programs directly editable while rhythm controls and knobs project precisely identified parts of that code. A VS Code style workbench organizes projects, history and assistance around this music editor.

## Positioning

The differentiator is the combination of inferred editable lenses, shared projections, musical history and reviewed assistance. Strudel supplies the music runtime. JamScript supplies the workbench and safe editing tools. Complex Strudel programs must remain usable even when a lens cannot safely edit an expression.

## Operating Context

Browser: initialize an app-managed workspace and edit its documents; add collaboration and assistance when their services are implemented. There is no native filesystem permission, folder picker, disk watcher, direct disk read/write or browser File System Access API path.

Desktop: initialize a workspace or open a selected local folder. Native file access, watching and saving are desktop capabilities. Git integration is optional and desktop-only. Local work requires no account and works offline with available audio assets. Sharing explicitly publishes selected project content; it does not expose the participant's filesystem.

The browser workbench has an activity bar, Files sidebar, document tabs, central music editor, selected-track Inspector, Output panel and status bar. It preserves DESIGN.md's compact editor and inline source-to-control relationships.

Musicians work primarily in BPM. The current tempo component uses four beats per cycle: 120 BPM equals 0.5 CPS. Editing BPM updates a supported source expression after typing pauses, with immediate Enter/blur application and the editor's undo history. Code edits update the display; unsupported or ambiguous tempo expressions disable visual writes. A per-document beats-per-cycle setting and advanced CPS view remain planned. A cycle is not inherently a bar or a beat; changing its interpretation must not silently change playback speed.

## Capabilities and Constraints

| Capability                                      | Current state                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Editing, rhythm/parameter lenses and undo       | Working CodeMirror editor; simple flat sound/rest strings and numeric gain/room/lpf/hpf arguments                             |
| Browser workspaces and documents                | IndexedDB create, rename, delete and autosave; explicit Night bus template; open document tabs keep separate CodeMirror state |
| Playback and audio output                       | Real Strudel adapter evaluates the active editor; audiocn Level Meter and Spectrum read its output analyser                   |
| Inspector                                       | audiocn Knob and Parameter Slider write supported source parameters through the checked patcher                               |
| Complex programs                                | Editable as code; full example compatibility, General MIDI initialization and complex editable lenses are pending             |
| Takes, Repo, presence, Rework and Share         | Hidden until real history, Git, collaboration, model and invitation services exist                                            |
| Desktop files, IntelliSense and workspace agent | Planned; no native file service, language server or agent is connected                                                        |

Future releases must support the complete eddyflux "coastline" program, including sample packs, variables, nested stacks, chords, voicing, mini-notation and modulation. Complex lenses edit explicit syntax without flattening patterns or replacing expressions with constants. Arbitrary modulation graph builders are outside this release.

The workspace agent uses Gemini, with the project owner's key stored only in private server configuration. It can propose reviewed edits across files and request explicit Git actions. General shell execution is excluded. Local use is anonymous; shared workspaces use email sign-in, invitations and owner/editor/viewer roles.

## Brand Commitments

- Name: JamScript. Tagline: "Code is the source. Lenses are how you play it."
- Dark indigo surfaces, warm paper text, sparse amber actions and the two existing font families.
- A compact JS/code-and-rhythm symbol with a Schibsted Grotesk wordmark; use the production assets in public/brand.
- Credit Strudel and preserve third-party notices. The project licence is AGPL-3.0-or-later in LICENSE; runtime notices are in THIRD_PARTY_NOTICES.txt. Keep the corresponding source available when distributing or hosting the application.
- Selected audiocn controls are copied locally, styled through JamScript tokens, and fed by Strudel's actual output or checked source patches. Their MIT attribution is preserved.

## Evidence on Hand

The original "Night bus" song and surrounding examples are synthetic. The editor and patcher have automated regression coverage. There are no verified adoption figures, testimonials, live collaborators or connected AI/Git service claims. Historical UI reports described an earlier static editor and have been retired; current behavior is recorded above and verified by the test suite.

## Product Principles

1. Source text is authoritative; controls, analysis and history labels derive from it.
2. Refuse unsafe or ambiguous edits visibly. Preserve unrelated source and one-gesture undo.
3. Local music projects do not require Git knowledge, an account or a network connection.
4. Keep browser workspaces app-managed; expose native files only through desktop adapters.
5. Review assistant proposals against the actual source version before applying them.
6. Show real service states. Fixtures cannot simulate collaboration, validation or successful writes.

## Accessibility & Inclusion

Keep keyboard access, meaningful labels, visible focus, non-color status cues, reduced-motion support and local scrolling. Target WCAG AA contrast. Preserve the existing source/lens focus behavior while reorganizing the surrounding application.
