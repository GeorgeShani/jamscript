# Reusable example reviews

## Changed files

- `src/components/jam/review-fixtures.ts`: separate immutable Repo, Take and Rework presentation fixtures; reuses existing literal diff rows with no comparison algorithm.
- `src/components/jam/InlinePanel.tsx`: one reusable ReviewPanel, Example diff label, optional summary/checks, local scrolling, fixed accessible heading/action areas, Added/Removed labels plus literal signs, no panel radius or shadow, heading focus and topmost Escape handling.
- `src/components/jam/RepoPopover.tsx`: closes the popover before opening review; suppresses competing popover focus restoration and supplies the persistent Repo chip as the nearby return target. Change-row launcher uses the existing Button component.
- `src/routes/index.tsx`: one active review with its launcher, shared Repo/Rework renderer, focus restoration or nearby input fallback. Playback logic untouched.
- `src/components/jam/EditorSlot.tsx`: existing locked-lens tooltip closes when review opens and cannot reopen underneath it.
- `src/test/review-panel.test.tsx`: fixture switching, heading focus, disabled apply, relevant actions, and topmost Escape tests.
- `AGENTS.md`, `roadmap.md`, and this report: review architecture and verification. Project memory saves standing review boundaries.

No packages, parser, comparison algorithm, CodeMirror, backend, Git engine, audio or playback implementation were changed. Design tokens, responsive frame and route metadata are unchanged.

## Checks

- 19 tests pass across review, editor-preview and routing suites.
- Browser verified Repo change opens only after its popover closes. Review heading receives focus; Close returns focus to the Repo chip because its original change row is no longer mounted.
- With a review open, opening Repo then pressing Escape closes only Repo; a second Escape closes review and returns focus. Plain review Escape also dismisses the panel.
- Rework opens the same renderer, labels the content Example diff, reports checks as Not checked, disables Accept change, and mounts Discard. Discard returns focus to Rework; keyboard submission retains the input as return target.
- Switching Repo → Rework → Repo uses one active review with one Example diff label, not stacked panels.
- Repo/Take/Rework fixture switching and relevant action selection verified in tests. The Take fixture supports Close comparison only, with no restore/apply operation.
- Locked-lens tooltip was visible on keyboard focus, then disappeared when Rework opened. It stays suppressed underneath an active review.
- At 1280×720, 1920×1080, 390×844, 390×420 and 1280×420, review bounds equal editor bounds. Heading/actions stay inside the editor and transport/Takes/Rework remain outside and reachable.
- At 390px the code scroller has 520px content width and scrolls locally without increasing document width. Body scroll preserves header/footer. Literal plus/minus and Added/Removed descriptions supplement 20% fills.
- Source read back unchanged after review opening/switching/dismissal. Play became Stop; opening/closing a Repo review left playback running; Stop returned to Play. No browser runtime errors. Audible output/sample delivery not assessed.
- Screenshots inspected for desktop and 390px short-screen layouts. Only existing semantic tokens/fonts and reduced-motion-aware controls are used; no decorative card treatment or modal added.

## Next-prompt gaps

- No Take comparison launcher exists in the current Takes rail. It still selects a Take and shows its pre-existing Restore preview. No new Compare action was invented; the Take review fixture is ready for a later launcher.
- Repo/Rework review content is synthetic, not computed against the current song or generated from the request. Nothing applies a change. Real comparison, validation and acceptance await the engine handoff.
- Physical-device safe areas/virtual keyboard and audible output remain unverified.