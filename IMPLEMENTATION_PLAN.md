# JamScript implementation plan

Approved direction: 17 October 2026. Steps 1 and 2 and the separately requested BPM component are complete. `UI_IMPLEMENTATION_PLAN.md` records the new browser workbench milestone; slices A–G below remain the broader desktop and service roadmap.

## Step 1: Direction and boundaries

- [x] Record the local-first, VS Code style workbench direction in PRODUCT.md and PRODUCT_PLAN.md.
- [x] Distinguish working capabilities from presentation examples and planned features.
- [x] Preserve the existing editor architecture and behavior. Core editor, lens and engine files remain unchanged; the separately requested BPM control adds only an editor-ready callback to EditorSlot.tsx.

JamScript is a music IDE with local folders, Tauri applications for Windows, macOS and Linux, a full collaborative browser companion, an owned Strudel language service, real Takes, optional Git and a Gemini workspace agent. Code remains the source of truth; lenses are checked projections of it. This supersedes the old frozen hackathon scope.

## Step 2: Documentation, structure and branding

- [x] Keep DESIGN.md, PRODUCT.md, PRODUCT_PLAN.md, AGENTS.md, README.md and this implementation plan as the original project Markdown set; the approved UI workbench receives its own `UI_IMPLEMENTATION_PLAN.md`.
- [x] Consolidate useful current guidance; remove the nine root verification reports, roadmap.md, docs/ui-handoff.md and src/routes/README.md. Repair references to retired files.
- [x] Retain the original, initially untracked PRODUCT_PLAN.md text as explicitly historical context inside that file.
- [x] Keep the route thin and organize existing presentation components into review, takes, repository, collaboration and assistant features. Keep shared UI primitives in components/ui and protected editor modules in place.
- [x] Remove unreachable starter UI components and their exclusive dependencies after an import audit. Avoid unused future service skeletons.
- [x] Consolidate DESIGN.md around the compact editor and approved workbench direction; remove superseded sizes and duplicated starter CSS.
- [x] Create a JamScript symbol and wordmark using the installed imagegen skill, then redraw a production SVG. Deliver monochrome variants, transparent PNGs, favicon and desktop icon assets.
- [x] Integrate the logo into the current shell without changing editor behavior. Verify small-size legibility and responsive layout.
- [x] Fetch the pinned Strudel AGPL text, add the root project licence and collect available runtime dependency notices in THIRD_PARTY_NOTICES.txt. Include font attribution and a repeatable collection command.
- [x] Run regression, type, lint and build checks; compare protected editor/engine files against their initial content.

Additional authorized delivery: a separate BPM component patches one supported, unambiguous tempo expression using Lezer syntax ranges and the existing editor undo history. Valid typing applies after 250ms; Enter/blur applies immediately. Invalid, stale, dynamic or ambiguous targets are refused. Code changes and undo refresh the displayed BPM. Configurable workspace beats-per-cycle and an advanced CPS view remain in slice A.

Document ownership: PRODUCT.md defines the product; DESIGN.md defines appearance; PRODUCT_PLAN.md records product rationale and historical context; `UI_IMPLEMENTATION_PLAN.md` owns the current browser workbench; this file owns the longer roadmap; README.md owns setup; AGENTS.md owns development guardrails.

## Step 3: Feature delivery, pending

Build complete, working slices in order. An example fixture is never evidence that a service works. Keep unfinished production capabilities hidden or explicitly unavailable. The browser milestone in `UI_IMPLEMENTATION_PLAN.md` provides app-managed workspace CRUD, tabs, autosave, selected-track controls and actual-output monitoring; remaining tasks below include desktop and service capabilities.

**Step 3 status (18 October 2026): in progress.** The A–G checkboxes below are acceptance items; leave them unchecked until each full item is verified. These smaller delivered slices are checked so progress is visible:

- [x] Browser workspaces, persistent documents and editor tabs; BPM-to-CPS source edits; the live output meter and source event highlights.
- [x] Desktop folder opening, explicit Save, unsaved-buffer recovery and external-change conflict handling in the current native implementation.
- [x] Coastline compatibility source and playback regression coverage. Stop remains available while Play loads and hard-mutes output when evaluation fails or a pattern continues unexpectedly.
- [x] Initial shared workspace routes, role-aware UI restrictions, private database schema and offline language-service transport.
- [x] Local, per-document Takes snapshots with comparison, audition and source restore.
- [x] A: native file deletion warns when it will also discard unsaved edits and their recovery copy.
- [x] B: mixer changes after Stop cannot restore the muted master output; the next successful Play restores the chosen level.
- [x] C: invitations reject invalid roles at the API and membership layers rather than silently granting editor access.
- [x] C: invitation email uses Resend's HTTP API (Worker-safe); SMTP/nodemailer is removed. Live Resend delivery still needs a configured `RESEND_API_KEY`.
- [x] D: offline hover and signature help cover the sample and chord calls used by the coastline fixture.
- [x] B: desktop audio now builds as a single classic script in an opaque-origin frame; browser and packaged macOS smoke tests confirmed ready, Play, nonzero output levels, and Stop. The full coastline fixture also evaluated in the isolated browser frame with nonzero output. Missing remote sample banks no longer abort unrelated playback.
- [x] B: the opaque desktop frame requests approved audio assets through a bounded parent bridge. IndexedDB keeps downloaded sample bytes for offline retries; the bridge omits credentials and refuses local endpoints. Packaged macOS Coastline Play and Stop showed live, nonzero output without a reported runtime error.
- [x] C: explicit sharing selects up to 32 safe music source files, seeds separate persistent Yjs rooms, and opens every shared file in the workspace. Owner invitations can be listed and revoked. Shared file renames persist to workspace metadata while retaining the document ID; the UI waits for server confirmation.
- [x] C: shared editor bindings can be removed and reconfigured when a document role changes, so an old writable CodeMirror binding is not retained after a downgrade.
- [x] D: the generated offline language index now includes bundled General MIDI sample names, and sound completions work inside mini-notation strings used by Coastline.
- [ ] Complete A–D acceptance, including native listening on Windows, macOS and Linux and a live two-person collaboration session.
- [ ] Complete complex lenses, optional native Git, and the Gemini agent (E–G).
- [x] E: bracketed rhythm subdivisions now expose individual keyboard-accessible buttons and surgical checked source patches, preserving spaces and adjacent tokens.
- [x] E: simple `<...>` sound and note alternation exposes each branch as an accessible control and patches only that branch; nested or unsupported forms stay locked.
- [x] E: simple `note()` / `n()` step grids (including one-level brackets and simple alternation) edit through the same checked rhythm path; euclid and nested mini-notation stay locked.
- [x] E: literal `.fast()` and `.slow()` speed operands use checked numeric lenses in nested chains; computed operands remain code-only.
- [x] E: repeated literal numeric methods in one chain receive distinct occurrence identities, so each operand can be patched without changing its neighbors.
- [x] F: successful Takes gain a musical label for exactly recognized single-control changes; other changes receive a neutral source-edit label.
- [x] F: selected desktop folders have optional local Git initialization, status, and commits for explicitly selected saved or deleted music files. A native throwaway repository test verifies stale file rejection and that an unselected file stays out of the commit.
- [x] F: an empty selected desktop folder can clone an HTTPS repository; local Git remotes support non-force push and clean fast-forward pull. Native throwaway-remote tests cover clone, push, pull, dirty refusal and divergence refusal. GitHub device authorization and OS credential storage remain pending.
- [x] G: a server-only Gemini proposal endpoint checks Clerk membership and editor rights, uses Cloudflare's per-user rate limit binding, reads bounded authorized shared sources, and validates proposed file identities and sizes. Configured shared editors can review and apply one active-file proposal through a stale-source check and one editor transaction.
- [x] G: workspace-scoped proposals can coordinate up to eight authorized files. Review opens affected tabs, checks every source snapshot before any write, and applies one isolated editor transaction per affected file; semantic patch proposals, Git tools and live service verification remain pending.
- [x] G: the agent receives bounded Strudel documentation and parse-only diagnostics for authorized files. Newly introduced JavaScript syntax errors are rejected without executing source. Proposal generation streams bounded progress events and supports client cancellation.
- [x] Collaborator UI: shared home lists one entry per workspace; owners see accepted members and pending invites, and can remove non-owner members.

18 October Takes slice: the workbench stores successful local evaluations per document in IndexedDB, deduplicates consecutive identical source, retains the latest 200, and offers musical labels, source comparison, audition and one-transaction editor restore in the Output panel. Takes remain private to this device; gesture grouping and shared synchronization are pending. Optional desktop Git initialization, status, selected-file commits, public HTTPS clone, non-force push and clean fast-forward pull are available. GitHub device authorization and credential storage remain pending. The old example Takes rail remains fixture-only and is not mounted in the workbench.

18 October implementation check: the browser workbench plays an active Strudel document with a live output meter and source event highlights that clear on Stop. The desktop web target and macOS app package build; the opaque-origin audio frame passed browser and packaged macOS smoke tests with nonzero output and Stop. The full coastline fixture evaluated in the isolated browser frame with nonzero output after the cache layer learned to handle denied storage access. Packaged macOS Coastline playback now also shows a live output meter and Stop succeeds. Subjective listening quality, a real offline sample replay, and Windows/Linux playback remain unverified. Stop now releases the transport while initialization is still pending. Shared document views reject viewer BPM/track writes; the shared route uses its actual workspace name. The offline language service now completes local declarations, resolves nested call signatures through syntax, and rejects version-stale requests. Full acceptance for A–D remains open, especially cross-platform desktop playback and a live two-person collaboration session; these live service checks have not been completed.

Initial work in progress: browser documents now persist their own beats-per-cycle interpretation and offer an advanced CPS readout without retiming source; the official coastline source is kept as a compatibility fixture, and the playback highlight regression tests run cleanly. A Clerk-scoped, read-only shared workspace metadata endpoint has been added. Desktop can open a selected folder, save explicitly, recover unsaved buffers, reload clean external edits, and hold a dirty conflict until the user loads disk or keeps the local buffer. The native watcher compiles. Executable music caches downloaded samples, reports a failed sample with a Play retry, and evaluates the coastline program without rewriting its crate or General MIDI parts. Shared projects list for a signed-in member, invitations can be accepted at `/app/invitations/:token`, and `/app/shared/:documentId` opens the document with its role. The Supabase database now has the private `jamscript` schema applied. Full coastline listening on Windows, macOS, and Linux, a live two-person session, private Git authentication, and a live Gemini service session remain unverified. The Apocalypse comparison source is retained as an internal fixture rather than a public asset.

Current browser slice: `/app` lists local workspaces, `/app/workspaces/:workspaceId` opens a specific IndexedDB workspace after refresh, `/app/library` searches local documents and opens the selected one, and `/app/help` explains the working editor and safe controls. Quick Open, the command palette and a syntax Problems panel are present. The Lezer lens scanner finds supported numeric arguments in nested stacks and unambiguous named pattern chains in the coastline and Apocalypse fixtures; computed or ambiguous targets remain code-only. These additions do not complete the desktop or collaboration acceptance criteria below.

Audio routing note: the complete coastline stack applies effects after combining its branches. Moving those branches into separate mixer orbits changed the effects and produced clipped output. Such stacks now play and export from their original source routing; their source lenses remain editable, while individual track faders are unavailable until a sound-preserving mixer design is verified.

### A. Workbench and local folders

- [x] Add a compact top bar, activity bar, resizable primary sidebar, file tabs, bottom Takes/Problems/output panel, right assistant pane and status bar. Back Quick Open and the command palette with one command registry.
- [x] Keep DESIGN.md's palette and fonts, 14px code, 24px rhythm cells, 28px knobs and inline lens relationships. Below 900px, retain two transport rows; show side panels as mutually exclusive drawers.
- [x] Make BPM the primary tempo display/input and CPS an advanced view. Store an explicit beats-per-cycle interpretation per document (default 4); derive BPM = CPS × 60 × beats-per-cycle. Changing that interpretation alone never changes playback. BPM edits patch one unambiguous supported setcps/setcpm expression through the checked transaction/undo path; dynamic or ambiguous source shows "Tempo from code" rather than guessing. Support a safe setcpm(BPM / beats-per-cycle) source form, including the supplied example's 0.75 CPS = 180 BPM at 4 beats per cycle.
- [x] Allow browser workspace initialization with app-managed documents only. Desktop additionally opens selected folders and supports native file creation/rename, Save, Save As, recent folders and dirty indicators. Native filesystem access is exclusively desktop; do not add browser folder pickers or a File System Access API fallback. Local desktop work requires neither an account nor a repository.
- [x] Keep document identity, selection, scroll position and undo history when switching tabs. Stop playback when switching songs.
- [x] Start with explicit saving. Watch files, reload clean external changes and compare dirty conflicts without overwriting them. Recover unsaved buffers after restart.

Acceptance: initialize a browser workspace and edit its app-managed documents without requesting native file permissions. On desktop, open a real folder, edit two songs, switch without losing document state, save and reopen them. Verify dirty-close handling, external conflicts, restart recovery and keyboard navigation.

Tempo acceptance: 0.5 CPS displays as 120 BPM at 4 beats per cycle; setting 140 BPM writes an equivalent safe source expression and undoes in one step. Typing in code updates the display. Changing beats per cycle does not retime existing music; dynamic/multiple tempo calls refuse visual writes. Reference: [Strudel cycles and BPM](https://strudel.cc/understand/cycles/).

### B. Desktop runtime and complete Strudel playback

- [x] Add Tauri v2 for Windows, macOS and Linux, with a dedicated static frontend build reusing the workbench. Preserve the current browser build while adding the desktop target.
- [x] Scope native file access to user-selected folders; reject path traversal and symlink escapes. Keep native access behind a platform adapter.
- [x] Preserve evaluation serialization and Stop cancellation. Register the General MIDI instruments missing from the installed web package's initialization and support external sample packs.
- [x] Isolate executable music in a sandboxed playback frame without native IPC, filesystem, Git or authentication access. Use a narrow, validated playback message interface. Received shared source never executes automatically.
- [x] Cache bundled/downloaded audio for offline reuse; expose actionable sample loading, unavailable-asset and retry states.
- [x] Add the official eddyflux "coastline" program as a compatibility fixture, preserving its author/version comments and Strudel source rather than chat escaping.

Acceptance: play the complete program, including crate drums and General MIDI piano/bass, in the browser and all three desktop targets. Verify nonzero output, listening quality, cached/offline playback, malformed source and Stop during initialization/loading.

### C. Collaborative workspaces

- [ ] Use Clerk authentication and session identity; add Supabase workspace metadata, memberships and invitations with authorization tied to that identity; use Liveblocks with Yjs for shared project text and presence.
- [x] Keep anonymous offline local work. Explicit sharing selects project files and excludes credentials, Git internals and dependency directories. External sample references stay source text.
- [ ] Implement owner/editor/viewer roles, revocable invitations, real presence, connectivity status and persistent workspaces available while the owner is offline.
- [ ] Give files stable IDs across rename. Synchronize source and metadata; derive lenses from the synchronized source on each client.
- [ ] Use origin-aware shared undo so a gesture is one undo step and local undo preserves other users' edits. Enforce viewer permissions on typing, lenses, shortcuts and assistant apply.
- [ ] Keep local folder bindings device-specific. Remote changes dirty the local working buffer; Save writes it. Persist offline edits and reconcile on reconnect.

Acceptance: desktop and browser participants concurrently edit and see real control updates; reconnect without lost changes, preserve local undo boundaries, reject viewer writes and revoked invites, and avoid duplicate initialization content.

### D. Strudel IntelliSense

- [ ] Own an LSP-compatible TypeScript language service with one analysis core, a Web Worker transport used by web/desktop and a stdio entry point for external editors.
- [ ] Integrate the official CodeMirror LSP client through additive extensions. Generate documentation/function data from the pinned Strudel API.
- [ ] Provide function/sample completion, hover documentation, signature help, diagnostics and workspace symbol navigation without evaluating source.
- [ ] Understand nested stacks, declarations, chord chains and mini-notation. Treat computed expressions conservatively; reject stale results and support cancellation.

Acceptance: completions and documentation work throughout "coastline," follow active file/document versions and work offline. Incomplete code remains editable without crashes or misleading errors.

### E. Complex editable lenses

- [x] Extend the existing Lezer-derived model and checked patcher in a separate implementation phase, preserving existing tests and editor behavior.
- [ ] Recognize nested stacks, unlabelled chains and variable references. Use document/node identity and exact syntax ranges rather than track labels or sample offsets.
- [ ] Render nested sequences, alternation and parallel groups structurally. Edit literal notes, sounds, rests, selectors and numeric operands for repetition, speed, weights and Euclidean patterns without flattening them.
- [ ] Keep modulation expressions intact; expose independently recognized numeric arguments only where their meaning and safe range are known. References link to their declaration instead of editing every use.
- [ ] Preserve surrounding whitespace/comments/operators, linked highlighting, focus, pointer capture and one-gesture undo. Refuse stale, shadowed, ambiguous or unsupported targets.

Acceptance: edit supported parts of "coastline" with surgical source patches and exact undo, including repeated method names and nested patterns. Verify invalid/ambiguous targets and unrelated nodes remain untouched.

### F. Real Takes and optional Git

- [x] Replace Takes fixtures with persistent, successful-evaluation snapshots, deduplicated by content; retain the latest 200 per song. Gesture grouping around completed edits remains pending.
- [x] Implement musical labels, computed comparisons, audition, return to live and restore through the document transaction path.
- [x] Implement native Git behind a Rust git2 adapter: initialize/open/clone, status, add/remove, commit, push and fast-forward pull. Offer editable musical commit messages and plain-language guidance.
- [ ] Add GitHub device authorization and OS credential storage. Refuse force push, automatic merges, destructive history changes and overwriting unsaved source. Browser users initialize app-managed workspaces and collaborate; native files and Git are desktop-only.

Acceptance: save without Git; then complete a real optional clone/edit/commit/push/pull flow against a throwaway repository. Check authentication failure, offline behavior, divergence refusal and safe loading.

### G. Gemini workspace agent

- [x] Keep the supplied Gemini key in private backend configuration. Use @google/genai with a configurable model, authenticated requests, limits and server-side authorization.
- [x] Let the agent read authorized project files, consult Strudel docs/diagnostics and propose coordinated edits through Ask/Edit chat. Explicit Git tools and general terminal execution remain outside this release.
- [x] Show streamed text, cancellation and actual failures in the assistant pane. Exclude secrets from context and logs (operation IDs only).
- [x] Review versioned multi-file proposals before apply; invalidate proposals after source changes. Git actions need their own explicit approval.
- [ ] Perform preservation checks only for the supported deterministic subset; do not execute arbitrary music as validation or substitute fixtures for real check results.

Acceptance: explain and propose a useful change to "coastline," review/apply a fresh proposal, reject stale/unauthorized edits, cancel pending work and keep credentials out of client assets and logs.

## Interfaces to introduce with their first working consumer

| Interface                      | Responsibility                                                               |
| ------------------------------ | ---------------------------------------------------------------------------- |
| WorkspaceFileSystem            | File access, watching, conflict detection and desktop/browser capabilities   |
| DocumentSession / EditorBridge | File identity, source revision, retained editor state, transactions and undo |
| CollaborationProvider          | Shared source, roles, presence, persistence and connectivity                 |
| LanguageServiceClient          | Versioned documents, completion, documentation, diagnostics and cancellation |
| TakeStore / GitService         | Actual history and repository operations                                     |
| AgentRun / ChangeProposal      | Tool events, source versions, checks, cancellation and reviewed changes      |

Typing, lenses, restore and assistant changes use the same document transaction path. Keep these interfaces capability-based; do not introduce unused stubs during the cleanup.

## Audio UI integration

audiocn is a candidate for copied, locally owned audio UI components. Its published requirements (React 19.2+, Tailwind v4 and shadcn/ui) match the current stack. It uses Base UI, whereas the current primitives use Radix; inspect each component's dependencies before adding it rather than replacing shared primitives wholesale.

- Start with an actual-output Level Meter and Spectrum in slice B. Feed real analyser values, respect reduced motion and stop animation when hidden. Do not ship demo signals as playback telemetry.
- Evaluate Knob and Parameter Slider in slice E behind the checked patcher. Preserve 28px sizing, logarithmic filter behavior, focus/pointer capture, keyboard input and gesture undo. Do not replace current CodeMirror widget DOM with React component roots during Steps 1–2.
- Copy only components with a real consumer. Map audio colors to JamScript tokens and retain required MIT notices when code is imported. Registering the registry alone does not implement any audio component.
- Keep Strudel responsible for audio; do not add a separate mixer/audio engine to make the controls appear functional.

References: [introduction](https://www.audiocn.dev/docs), [knob](https://www.audiocn.dev/docs/components/knob), [repository and licence](https://github.com/audiocn/ui).

## Verification and release

Baseline before this work: 73 passing tests in 10 Vitest files. Preserve that suite, add behavioral tests for integrations and run bun run test, bunx tsc --noEmit, bun run lint and bun run build as applicable. Confirm production assets are actually usable for each runtime rather than assuming the current Cloudflare worker output is a static desktop bundle.

Steps 1–2 verification, 17 October 2026: 94 tests pass across 12 files; TypeScript, ESLint and the production build pass. The build retains dependency/plugin and large-chunk warnings. Browser checks confirm automatic 120 BPM → setcps(0.5), reverse code synchronization, undo, branding and narrow-screen layout. Core code-editor, live-lenses, session, music-document, playback and Strudel declaration file hashes match the baseline; EditorSlot has only the authorized ready callback. The licence collector generated notices for 217 packages with 78 unique texts. Desktop packaging, cloud services and full coastline playback have not been implemented or verified in this pass.

CI will run frontend checks, Rust checks and Windows/macOS/Linux packaging. Verify keyboard order, focus restoration, resize controls, narrow screens and 200% zoom. Observe service failures using operation IDs and connection state without storing source or credentials in logs.

Managed-service configuration, model credentials, GitHub OAuth configuration and desktop signing certificates are deployment prerequisites. No service is presented as connected before verification. Store submission, automatic updates, a general terminal, modulation graph builders and a marketing redesign are outside this release.

## Sources and implementation references

- [Strudel "coastline" source and workshop](https://strudel.cc/workshop/getting-started/)
- [Strudel sample loading](https://strudel.cc/learn/samples/)
- [Tauri filesystem permissions](https://v2.tauri.app/plugin/file-system/)
- [Tauri frontend configuration](https://v2.tauri.app/reference/config/)
- [CodeMirror LSP client](https://codemirror.net/docs/ref/#lsp-client)
- [Yjs CodeMirror binding](https://github.com/yjs/y-codemirror.next)
- [Liveblocks Yjs API](https://liveblocks.io/docs/api-reference/liveblocks-yjs)
- [Liveblocks room permissions](https://liveblocks.io/docs/api-reference/authentication/permissions)
- [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Gemini API key handling](https://ai.google.dev/gemini-api/docs/api-key)
