<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Project context

- Read PRODUCT.md for current capability status, DESIGN.md for visual work, and IMPLEMENTATION_PLAN.md for execution order. PRODUCT_PLAN.md preserves the superseded hackathon plan as historical context; its old freeze and single-screen restrictions do not govern the new workbench.
- This cleanup executes Steps 1–2 plus the explicitly requested BPM control. Keep `code-editor.ts`, `live-lenses.ts`, `session.ts` and all `src/engine/` files unchanged. `EditorSlot.tsx` exposes only an additive editor-ready callback for the tempo control; complex syntax belongs to later feature slices.
- Keep route files thin. The session shell lives in `src/workbench/`; Takes, review, repository, collaboration and assistant presentation live in `src/features/`. Shared UI primitives stay in `src/components/ui/`. Introduce service interfaces only with a working consumer.
- Browser workspaces are initialized and managed within the app. Native folder access, disk reads/writes, watchers and Git are desktop-only; do not add a browser File System Access API fallback.
- Keep the durable Markdown set to AGENTS.md, README.md, DESIGN.md, PRODUCT.md, PRODUCT_PLAN.md and IMPLEMENTATION_PLAN.md. Update these owners instead of adding verification or handoff reports.
- When `/graphify` is invoked, read and follow the installed graphify skill before running its workflow.

## Existing editor and preview guardrails

- CodeMirror's document is the live music source. `session.ts` supplies only the initial demo song; Play must evaluate current editor text, and source-derived controls must write through the checked patcher and the same undo history.
- Contain the editor in a dynamic-viewport frame with shrinkable children; code lines scroll locally while lenses wrap, and the toolbar switches to a two-row grid when its controls cannot fit, preserving access without document overflow.
- Derive lens ranges from Lezer syntax in `src/engine/music-document.ts`. Refuse invalid, ambiguous or unsupported targets; never use sample offsets or string-wide replacement. Simple rhythm tokens and numeric gain/room/lpf/hpf arguments are supported. Filters use logarithmic drag scaling. Preserve pointer capture and focus when refreshing widget values.
- Route all inline reviews through one active review state and a shared static renderer; close Repo before handing off focus, retain the launcher's focus target, and keep immutable review fixtures separate from document state so examples cannot apply changes.
- Keep Takes fixtures and literal comparison rows in a presentation-only module, with selection owned by the rail independently of its fixture current marker; non-default states are prop-only so no Play, timer or disabled action can simulate history.
- Coordinate Repo and Share through one toolbar popover state and suppress outgoing focus restoration during handoff; read the preview URL only on opening and await clipboard writes before reporting success so presentation cannot imply live collaboration.
- Keep Repo fixtures and pure preview transitions in a presentation-only module; the popover owns local selection independently of its fixed Open marker, and no preview transition reaches document, Take, Git, storage or network state.
- Keep Rework request selection in its presentation bar and check states in explicit fixtures; only the named sample opens a fixed proposal through the shared review, and no check state enables apply or invokes validation.
- Match transport DOM placement to the toolbar breakpoint and make covered editor previews inert; keyboard order must follow the visible layout without positive tab indices or focusable obscured controls.
- Reset lens and floating-layer typography explicitly, and constrain third-party feedback motion through the shared stylesheet; code-container inheritance and library defaults must not override approved text roles.
- Follow DESIGN.md's latest compact working editor revision: 14px code, 24px steps, 28px knobs and a 48px desktop toolbar. Keep the 900px toolbar breakpoint shared by CSS and transport placement. Repo, Takes, presence and Rework remain labeled examples until explicitly implemented.
