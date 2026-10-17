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

- Keep first-use guidance and lens preview state in the presentation layer, separate from immutable synthetic session fixtures; previews must never masquerade as document edits.
- Contain the editor in a dynamic-viewport frame with shrinkable children; code lines scroll locally while lenses wrap, and the toolbar switches to a two-row grid when its controls cannot fit, preserving access without document overflow.
- Use explicit sample-only token mappings and independent pointer/focus relationship state; keep parameter preview bounds linear and separate from engine ranges so presentation cannot infer edits or musical behavior.
- Route all inline reviews through one active review state and a shared static renderer; close Repo before handing off focus, retain the launcher's focus target, and keep immutable review fixtures separate from document state so examples cannot apply changes.
- Keep Takes fixtures and literal comparison rows in a presentation-only module, with selection owned by the rail independently of its fixture current marker; non-default states are prop-only so no Play, timer or disabled action can simulate history.
- Coordinate Repo and Share through one toolbar popover state and suppress outgoing focus restoration during handoff; read the preview URL only on opening and await clipboard writes before reporting success so presentation cannot imply live collaboration.
- Keep Repo fixtures and pure preview transitions in a presentation-only module; the popover owns local selection independently of its fixed Open marker, and no preview transition reaches document, Take, Git, storage or network state.
- Keep Rework request selection in its presentation bar and check states in explicit fixtures; only the named sample opens a fixed proposal through the shared review, and no check state enables apply or invokes validation.
- Match transport DOM placement to the toolbar breakpoint and make covered editor previews inert; keyboard order must follow the visible layout without positive tab indices or focusable obscured controls.
- Reset lens and floating-layer typography explicitly, and constrain third-party feedback motion through the shared stylesheet; code-container inheritance and library defaults must not override approved text roles.
- Follow DESIGN.md's 17 October roomier editor revision over the original dense dimensions: larger source and controls, distinct track spacing, quiet secondary rails, and a 900px toolbar breakpoint shared by CSS and transport placement.
