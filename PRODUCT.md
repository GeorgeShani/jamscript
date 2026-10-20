# Product

<!-- impeccable:product-schema 1 -->

## Platform

Desktop music IDE for Windows, macOS and Linux, with a collaborative browser companion. The public product site is at `/`; the working browser IDE is at `/app`. The desktop shell can open a selected folder and save those files; Windows and Linux packaging, collaboration, and the workspace agent are still pending.

## Stack

Current: TanStack Start in SPA mode on Cloudflare Workers, React 19, TypeScript, Tailwind v4, shadcn/ui, CodeMirror 6, Strudel, selected audiocn controls, and Clerk account controls. Local Lovable build and reporting code has been removed; disconnect the external Lovable GitHub link before pushing this change.

Chosen additions: Tauri v2 for desktop; Supabase for workspace metadata and invitations; Liveblocks/Yjs for shared documents; an owned Strudel language service; Gemini behind a private backend endpoint. Clerk sign-in is connected, while account-backed workspace sync remains planned. See IMPLEMENTATION_PLAN.md for delivery order.

## Users

Developers who jam and musicians comfortable exploring code. Someone should be able to make and save music without knowing Git or owning a GitHub account. Shared projects should work across desktop and browser participants. JamScript owns workspace management; Git is an optional desktop enhancement.

## Product Purpose

Code is the source. Lenses are how you play it. JamScript keeps Strudel programs directly editable while rhythm controls and knobs project precisely identified parts of that code. A VS Code style workbench organizes projects, history and assistance around this music editor.

## Positioning

The differentiator is the combination of inferred editable lenses, shared projections, musical history and reviewed assistance. Strudel supplies the music runtime. JamScript supplies the workbench and safe editing tools. Complex Strudel programs must remain usable even when a lens cannot safely edit an expression.

## Operating Context

Browser: initialize an app-managed workspace and edit its documents; add collaboration and assistance when their services are implemented. There is no native filesystem permission, folder picker, disk watcher, direct disk read/write or browser File System Access API path.

Desktop: initialize a workspace or open a selected local folder. Native file access, watching and saving are desktop capabilities. Git integration is optional and desktop-only. Local work requires no account and works offline with available audio assets. Sharing explicitly publishes selected project content; it does not expose the participant's filesystem.

The browser workbench has an activity bar, Files sidebar, document tabs, central music editor, selected-track Inspector, Output and Problems panel, Quick Open, command palette and status bar. The workspace chooser lives at `/app`; `/app/workspaces/:workspaceId` opens a local workspace, `/app/library` searches local documents, and `/app/help` documents the current controls. It preserves DESIGN.md's compact editor and inline source-to-control relationships.

Musicians work primarily in BPM. Documents default to four beats per cycle: 120 BPM equals 0.5 CPS. Editing BPM updates a supported source expression after typing pauses, with immediate Enter/blur application and the editor's undo history. Code edits update the display; unsupported or ambiguous tempo expressions disable visual writes. A per-document beats-per-cycle setting and advanced CPS view are available. A cycle is not inherently a bar or a beat; changing its interpretation does not change playback speed.

## Capabilities and Constraints

| Capability                                | Current state                                                                                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editing, rhythm/parameter lenses and undo | Working CodeMirror editor; supported numeric parameters in nested stacks and unambiguous named pattern chains, including the coastline fixture                                                     |
| Browser workspaces and documents          | IndexedDB create, rename, delete and autosave; explicit Night bus template; open document tabs keep separate CodeMirror state                                                                      |
| Clerk account controls                    | Sign-in, sign-up and signed-in user controls; browser workspaces remain usable without an account                                                                                                  |
| Playback and audio output                 | Real Strudel adapter evaluates the active editor; audiocn Level Meter and Spectrum read its output analyser                                                                                        |
| Inspector                                 | audiocn Knob and Parameter Slider write supported source parameters through the checked patcher                                                                                                    |
| Complex programs                          | Editable as code; supported literal parameters surface as controls in compatibility fixtures. General MIDI soundfonts are registered for playback. Full audio quality verification remains pending |
| Takes                                     | Local successful-evaluation snapshots in IndexedDB, with audition, one-step editor restore and labels for recognized control changes; shared history remains planned                               |
| Git and Rework                            | Desktop activity-bar Git sidebar: init, add/update origin, commit selected music files, non-force push and fast-forward pull, plus clone into an empty folder. GitHub credentials use OS keychain storage with optional device authorization (`JAMSCRIPT_GITHUB_CLIENT_ID`) or a pasted fine-grained token. |
| Desktop files and IntelliSense            | Desktop opens a selected folder, saves, recovers unsaved buffers, and compares disk conflicts. An offline TypeScript/Strudel worker provides inferred JavaScript members, signatures, definitions, references and rename with shared browser/desktop suggestion UI                                          |
| Workspace agent                           | Server-only Gemini Ask/Edit chat for browser and desktop (desktop calls the Worker via `JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN`). Ask can use active or workspace source context; Edit returns structured, syntax-checked multi-file proposals for review and CodeMirror apply. Chat history and cancellation work locally. Git tools remain planned. |
| Collaborators                             | Owners invite by email, list members and pending invites, and can remove non-owner members. Connected peers show coloured avatars, tab dots for which file they have open, named cursors in the editor, and names in the status bar                                   |

The track mixer routes independently mixable patterns. A stack with effects applied after it keeps its original Strudel audio routing; source controls remain available, and individual track faders are omitted to avoid changing the sound.

During playback, checked knob, slider, rhythm-grid and BPM edits stream to Strudel while the gesture continues. Typed code stays staged for Ctrl/Cmd+Enter; autosave remains independent. Control edits map onto the last applied program without publishing unrelated staged typing. If a control overlaps unapplied text, the user must apply that text first. Pattern changes affect upcoming scheduled events; existing note envelopes and effect tails are not rewritten.

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
