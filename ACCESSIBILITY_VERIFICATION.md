# JamScript consistency and accessibility pass

## Concrete failures fixed

- Lens parameter names and the locked explanation inherited Martian Mono from the code scroller. Lens strips now explicitly use Schibsted Grotesk, with explicit mono numeric values retained.
- Third-party toast defaults rendered a system font, white surface and 400ms motion. Feedback now uses the approved floating surface, paper text, 13px Schibsted Grotesk and 150ms easing; reduced motion disables animation/transitions. The library's unrelated global toast shortcut is disabled.
- Covered editor preview controls remained in keyboard navigation beneath inline reviews. The covered editor is now inert while a review is open, retaining local preview state.
- Mobile Play was visually first but later in DOM order. Transport placement now follows the same 700px breakpoint as the toolbar, preserving desktop order and putting Play first on small screens.
- Clipboard failure and playback errors used assertive alerts. They now announce politely; clipboard failure, Rework refusal and blank commit validation are associated with their relevant fields. Commit validation exposes invalid state.
- Repo's popover lacked an accessible title. It now references its visible heading.
- Knobs lacked a pressed surface state. Presentation-only active feedback is now present without changing existing arrow/Shift-arrow behavior or scaling.
- Shared popovers/tooltips had editor entrance effects, including an unspecified tooltip duration. Nonessential entrance effects were removed.
- Review source rows were 13px rather than 14px code. They now use the code typography utility; ordinary UI and values remain 13px and labels 12px.
- Repo history prose is sans rather than blanket mono. A visible Strudel attribution and genuine project-home link are present in the existing first-use guidance.

## Checks actually performed

- Read PRODUCT.md, DESIGN.md and all UI-preview constraints. No engine, synchronization, Git, backend, fixture song or dependency/configuration changes.
- Chromium's platform-font inspection confirmed loaded custom Schibsted Grotesk glyphs for the wordmark and lpf parameter name, and loaded custom Martian Mono glyphs for tempo; this is more than a fallback-family declaration check. Toast computed font is Schibsted Grotesk.
- Keyboard-only journey: Repo opening, file navigation, blank commit validation, Ctrl+Enter preview commit, Escape and focus return; Play, Share, copy, Escape; guidance dismissal; rhythm Space and Enter; all three parameter arrow and Shift-arrow steps; locked percussion Space/Enter refusal; Take selection/Compare; review heading focus, covered controls skipped, Share-on-review topmost Escape; Rework refusal, sample selection, Enter proposal, disabled Accept and Escape focus return.
- Arrow/Shift-arrow regression tests cover concrete preview increments and upper/lower clamps for gain, lpf and room. Existing engine ranges remain untouched.
- Native clipboard success read back exactly the current preview URL; Sonner's region is polite. Simulated clipboard rejection showed the described manual-copy message and no success claim.
- Amber 2px keyboard outlines were inspected after transitions settled. Reduced-motion popovers and toasts compute animation none and zero transition duration.
- Screenshots inspected at 1280x1800, 1920x1080, 390x844, 375x812 and 640x900. Document width equals viewport width; Share remains contained. Local code/Takes scrolling and wrapped lens layouts are retained.
- Fresh-page tab order: desktop Repo, NK, GS, Play, Share; small viewports Play, Repo, NK, GS, Share. No positive tab indices introduced.
- Native Ctrl-plus zoom did not change headless Chromium's viewport or device pixel ratio. A 640x900 viewport exercises equivalent reflow for a 1280x1800 view at 200%; an additional CSS zoom=2 diagnostic preserved document width, but is not claimed as actual browser zoom.
- Code read back byte-identical after all preview flows; current Take remained the fixture marker. Play became Stop, stayed Stop through preview interactions, then returned to Play. No browser runtime errors observed.
- All 65 tests passed across the seven existing test files. Automatic production build reported build OK after the final UI changes; no manual build was run because the environment builds automatically.
- Only the index content route exists; its unique JamScript title, description, Open Graph title/description/type and Twitter card remain intact.

## Remaining limitations and handoffs

- A genuine JamScript source-repository URL is absent from the provided references and UI. Supply that URL before adding the required Source link; no repository URL was invented. Strudel attribution is preserved, but this does not claim AGPL submission/legal completeness.
- Audible output, sample delivery, physical-device safe areas/virtual keyboards and assistive-technology speech remain unverified. Temporary externally hosted samples remain an engine handoff, unchanged here.
- Actual native 200% browser zoom remains a manual-browser check. Equivalent reflow and CSS zoom diagnostics are not substitutes for claiming that check.
- Playback error's polite presentation was inspected in source; no real malformed-source flow was introduced into the read-only synthetic editor to trigger it.
- No automated accessibility score or WCAG compliance claim is made. Disabled history/apply/Git/collaboration actions remain visibly explained previews, not connected capabilities.