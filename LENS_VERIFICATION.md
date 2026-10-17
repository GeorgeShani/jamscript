# Lens strip refinement

## Changed files

- `src/components/jam/EditorSlot.tsx`: sample-token grouping, keyboard-focusable exact mapped tokens, independent hover/focus relationships, cyan lens rings separate from amber focus outlines, panel lifecycle cleanup, track/step/sound toggle names, linear parameter value previews, stable tabular widths, Hz cutoff values, track-specific slider names and value descriptions, keyboard/hover locked explanation.
- `src/routes/index.tsx`: passes existing inline-panel visibility into the editor to prevent stale relationships across panel opening/closure. Playback logic unchanged.
- `src/test/editor-preview.test.tsx`: updated preview expectations and added exact mapping, duplicate-number isolation, bidirectional focus/hover, pointer/focus handoff, panel lifecycle, lock refusal, and source immutability coverage.
- `AGENTS.md`: records explicit sample mappings and separation of linear preview bounds from engine behavior.
- `roadmap.md`: completed lens refinement tasks.
- `LENS_VERIFICATION.md`: this report.

Project memory also records the requested standing lens preview rules. `session.ts`, `styles.css`, engine files, packages, build configuration, responsive frame, Repo content and Takes/Rework behavior are unchanged.

## Verification

- 15 tests passed across editor preview and routing tests.
- All six lenses focus only their exact mapped sample token: complete quoted drums/hats/perc patterns, hats gain `0.6`, bass lpf `1200`, bass room `0.2`. Reverse token hover and keyboard focus light only the corresponding whole lens.
- Identical `0.6` tempo and gain numbers do not cross-highlight. Unmapped code, including bass note and instrument strings, stays unlinked.
- Hover exit and blur clear their own relationship; pointer exit does not erase an active keyboard relationship. Opening/closing the existing inline panel clears stale relationships. State is mount-local and disappears on unmount.
- Perc is dimmed at 50%, has no editable cells, does not respond to Space/Enter/click, and exposes the safety reason both persistently to assistive technology and in a visible tooltip on focus/hover. Escape closes the explanation and clears its relationship.
- Rhythm cells remain 24px with 4px within-group gaps and 12px group gaps. Every cell exposes `aria-pressed` and its track, step and current sound/rest.
- Knobs remain 32px. Parameter names use 12px sans; fixed-width values use 13px mono and tabular numbers. Cutoff consistently uses Hz; gain/room use two decimals. Keyboard arrows and Shift-arrow update only local preview values.
- Live Chromium check: Play became Stop, parameter/rhythm previews changed while playback continued, source remained byte-for-byte identical, and Strudel's code-update count remained one before/after preview adjustments. Stop returned to Play. No runtime errors.
- Layout checked at 1280×720, 1920×1080, 768×1024 and 390×844: document width equals viewport width; strips wrap while code retains local scrolling.
- Screenshot and computed-style checks confirmed separate cyan relationship ring and amber keyboard outline (`oklch(0.82 0.14 72)`, 2px). Reduced-motion lens transitions compute to zero seconds.
- Latest automatic preview build passed. Content route metadata remains app-specific and unchanged.

## Remaining engine-dependent behavior

These are explicitly control previews, not source or sound edits. Parsing, safe source patching, real musical ranges/log-scale behavior, pointer gesture transactions, double-click value entry, undo/history, dynamic lens generation, edit flashes and collaboration remain for the engine handoff. Locked perc never becomes editable in this pass.

Playback files and audio behavior were not modified. Audible output and sample delivery were not verified: headless Chromium captured no sample responses in this run. Physical-device safe areas and virtual-keyboard behavior remain unverified.