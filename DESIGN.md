---
name: "JamScript"
description: "A projectional music editor on Strudel: the code is the source, and knobs and step grids are live views of it."
colors:
  stage: "oklch(0.195 0.030 278)"
  panel: "oklch(0.225 0.032 278)"
  floating: "oklch(0.255 0.033 278)"
  floating-shadow: "oklch(0.10 0.02 278 / 55%)"
  hover-row: "oklch(0.285 0.032 278)"
  hairline: "oklch(0.335 0.030 278)"
  control-edge: "oklch(0.560 0.030 278)"
  selection: "oklch(0.400 0.060 278)"
  paper: "oklch(0.940 0.014 85)"
  paper-dim: "oklch(0.750 0.020 278)"
  record-amber: "oklch(0.820 0.140 72)"
  patch-cyan: "oklch(0.820 0.110 205)"
  rework-violet: "oklch(0.740 0.140 300)"
  fail-red: "oklch(0.680 0.190 25)"
  pass-green: "oklch(0.800 0.150 150)"
  caution-yellow: "oklch(0.880 0.150 100)"
  track-sky: "oklch(0.740 0.130 243)"
  track-rose: "oklch(0.740 0.160 342)"
  track-moss: "oklch(0.700 0.130 153)"
  track-mustard: "oklch(0.780 0.160 105)"
  track-clay: "oklch(0.740 0.100 42)"
  track-lilac: "oklch(0.860 0.100 315)"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  ui:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
  code:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.85
    fontFeature: "tnum"
  code-small:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  gutter:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 2.36
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.record-amber}"
    textColor: "{colors.stage}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-outline:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-marketing:
    backgroundColor: "{colors.record-amber}"
    textColor: "{colors.stage}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  input:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  lens-cell-on:
    backgroundColor: "{colors.record-amber}"
    rounded: "{rounded.sm}"
    size: "24px"
  lens-cell-off:
    backgroundColor: "{colors.hover-row}"
    rounded: "{rounded.sm}"
    size: "24px"
  take-chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  popover:
    backgroundColor: "{colors.floating}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "8px"
---

# Design System: JamScript

This is the current visual specification. PRODUCT.md owns capability status and IMPLEMENTATION_PLAN.md owns delivery order. The current shell is a compact single-document editor; the approved workbench is the target for a later implementation slice.

## Character

**The Patch Cable:** source and controls are the same object. Their shared highlight is the signature interaction. The surrounding IDE stays quiet, compact and familiar: dark indigo surfaces, warm paper text, sparse amber actions and flat panels separated by hairlines.

Keep the editor as the largest useful surface. Use familiar navigation and controls rather than a hardware-console costume. No gradients, glow, glass, decorative motion or neon. The original roomier editor revision and paste-ready starter CSS have been superseded; src/styles.css is the actual stylesheet.

## Palette

Use semantic tokens in components. Static brand assets may use the matching solid palette values.

| Role                  | Reference color             | Use                                               |
| --------------------- | --------------------------- | ------------------------------------------------- |
| Stage                 | #121322                     | Editor and page ground                            |
| Panel                 | #181A2B                     | Toolbar and docked panels                         |
| Floating              | #1F2133                     | Menus, tooltips and command palette               |
| Hover Row             | #26293A                     | Row hover and inactive surfaces                   |
| Hairline              | #333546                     | Decorative separators                             |
| Control Edge          | #707386                     | Visible input/control boundaries                  |
| Paper                 | #EFEBE1                     | Main text                                         |
| Paper Dim             | #ABADBB                     | Secondary text                                    |
| Record Amber          | #FCB452                     | Primary actions, active steps and selected states |
| Patch Cyan            | #5ED9E6                     | Exact source-to-control relationship only         |
| Rework Violet         | #B995F6                     | Assistant identity                                |
| Pass / Fail / Caution | #6ED889 / #F75D59 / #EFD956 | Real checks and status                            |

Tracks use the existing track-1 to track-6 tokens: sky, rose, moss, mustard, clay and lilac. Assign them in source order and also show the track label. People use track colors plus names/initials. Never use cyan as a general link or decorative brand color.

## Typography

Only Schibsted Grotesk and Martian Mono. Schibsted sets the wordmark, navigation, labels, sentences and buttons. Martian sets source, paths, branch names and changing numeric values. Keep sentence case and normal tracking; no all-caps labels or italic decorations.

| Role                | Size / behavior                               |
| ------------------- | --------------------------------------------- |
| UI                  | 13px, regular                                 |
| Label               | 12px, medium                                  |
| Badge / gutter      | 11px; badge reserved for status/initials      |
| Code                | 14px on 26px rows; mono with tabular numerals |
| Numeric/path detail | 13px mono                                     |
| Empty/dialog title  | 16px or 20px semibold                         |

Reset typography inside lens widgets and floating layers explicitly. Editor inheritance and third-party defaults must not change these roles.

## Current working editor

- The viewport frame uses dynamic viewport height and shrinkable children. Source lines scroll inside CodeMirror, while inline lenses wrap locally. The page itself must not overflow horizontally.
- The desktop toolbar is 48px. The shared CSS/transport breakpoint is 900px; below it the toolbar becomes 40px and 36px rows, with Play in the first row.
- Rhythm cells are 24px and knobs 28px. Knob name and value sit on one line beside the dial. Filters retain logarithmic scaling.
- Keep fixture-only Takes and Rework styling dormant until those features have real backing services.
- Source is directly editable. Ctrl/Cmd+Enter evaluates current source. Valid changes while playing use the existing debounce and playback queue.
- Keep source-derived lenses immediately under their owning statement with the track-colored left rule. No static preview or first-use disclaimer above the real editor.
- Keep compact controls at normal browser zoom; allow internal scrolling rather than enlarging every track section.

The browser workbench changes the surrounding shell. It keeps the editor and lens widget DOM intact; the playback adapter exposes its actual audio output to the analyser.

## Current browser workbench and later desktop target

Adopt VS Code's organization with JamScript's visual system:

1. Compact top bar with branding, workspace identity, BPM and transport.
2. Activity bar with Files and Inspector controls.
3. Collapsible Files sidebar and document tabs above the central music editor.
4. Bottom Output panel with real Level Meter and Spectrum.
5. Right selected-track Inspector and compact status bar.

Search, Source Control, Collaboration, Takes, assistant pane, Quick Open and a command palette follow when their behavior is implemented. Git is an optional desktop integration; JamScript manages workspaces independently.

Docked panels sit flush with hairline separators; reserve shadows for floating layers. Keep the central editor dominant. Below 900px, panels become mutually exclusive drawers rather than compressing the editor into a narrow column. Keyboard order follows the visible arrangement.

The browser entry offers workspace initialization and app-managed documents only. Open Folder, native Save/Save As, native file operations and disk watchers are desktop capabilities. Do not offer browser filesystem permission flows.

The current shell has a separate BPM input using four beats per cycle. Valid edits update the supported CPS/CPM source expression after a 250ms typing pause, or immediately on Enter/blur, through a checked, undoable transaction. Code edits and undo update the input. Unsupported or ambiguous source disables the input and displays "Code." The target workbench will add an explicit per-document beats-per-cycle setting and an advanced CPS view. BPM = CPS × 60 × beats-per-cycle; changing the interpretation alone must never retime playback.

## Interaction and review

Source and lenses share exact range highlights. Keep pointer capture and focused DOM nodes during refresh. One drag produces one undo step. Unsupported or ambiguous syntax stays editable as code with a clear refusal from its lens.

Use one active review and retain its launcher's focus target. Covered editor content is inert. Repo and Share share one popover state; close outgoing layers without stealing focus from the incoming layer. Escape closes the topmost layer first.

Takes, Repo, avatars, Share and Rework are hidden in the working browser UI until their real capability is implemented. Static fixtures remain separate from document and playback state.

Real assistant changes use a versioned diff with review before apply. A stale proposal cannot apply. A check is shown as passed only after the corresponding real check succeeds.

## Audio UI and audiocn

Use audiocn selectively, as locally owned components with an actual data source. Its Base UI dependencies coexist with existing Radix primitives; no blanket primitive migration is needed.

- Level Meter and Spectrum read the analyser tapped from actual Strudel output; never use demo signals to imply audio output.
- Knob and Parameter Slider in the Inspector edit supported source syntax through the checked patcher and the same undo history.
- Reuse Strudel's audio graph. A new display component does not own the song or start a second engine.
- Map library tokens to this palette, retain readable labels, honor reduced motion and stop hidden visualizers. Avoid the electric/glowing variants.
- Retain the MIT notice when importing code. No audiocn code is installed by Steps 1–2.

See [audiocn's introduction](https://www.audiocn.dev/docs) and [source](https://github.com/audiocn/ui).

## Identity and logo

The production symbol is an abstract JS monogram built from code brackets and a continuous patch-cable gesture. Use solid amber by default, paper on dark monochrome surfaces and stage ink on light backgrounds. Keep cyan reserved for source relationships.

Assets live in public/brand. mark.svg is the scalable master; logo.svg combines it with an outlined Schibsted Grotesk wordmark. The wordmark is exactly "JamScript", with those capitals. Use the mark alone at small sizes, and retain clear space of at least a quarter of its width.

Use logo.svg as the complete header identity. Derive browser and desktop icons from app-icon.svg, which uses the same symbol. Use the ink variants on light backgrounds.

- Verify mark legibility at 16, 24 and 32 pixels; do not squeeze the wordmark into a favicon.
- Use supplied monochrome variants rather than filters, glows or gradients.
- Use the app-icon assets for desktop packaging and favicon.ico for browser fallback.
- The generated image is a concept reference; production assets are flat vectors. Asset provenance and the image-generation prompt are in public/brand/manifest.json.

## Accessibility and verification

Keep visible focus, meaningful labels, keyboard control and non-color state cues. Grid cells expose toggle state and knobs expose slider semantics. Target WCAG AA text contrast and 3:1 control boundaries. Respect prefers-reduced-motion; library transitions cannot override it.

Check the live editor and all layers at desktop, tablet, narrow-phone widths and 200% zoom. Verify local scrolling, no hidden focus targets, preserved review focus return and unchanged Play/Stop behavior. Physical-device safe areas, virtual keyboards, assistive-technology speech and audible output require their own runtime checks; a screenshot or passing unit test does not prove them.
