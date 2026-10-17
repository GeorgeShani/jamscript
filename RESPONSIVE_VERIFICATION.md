# Responsive editor verification

Measured in Chromium against the running app. Screenshot captures were inspected at each requested size.

| Viewport | Document width | Toolbar height | Takes height | Rework height |
| --- | ---: | ---: | ---: | ---: |
| 1280x720 | 1280px | 44px | 56px | 48px |
| 1920x1080 | 1920px | 44px | 56px | 48px |
| 768x1024 | 768px | 44px | 56px | 48px |
| 390x844 | 390px | 73px (two rows including divider) | 56px | 48px |

- Play, Share and Dismiss were inside the viewport at every requested size.
- At 390px Play started the existing playback and became Stop; Stop returned to Play. Audible sound was not assessed.
- Long bass code retains whitespace and scrolls in its own focusable code-line region: 390px visible width, 596px content width. Horizontal scrolling was exercised; lenses remain within the visible document width.
- Takes list scrolled 161px without moving or widening its surrounding rail.
- Rework input, submission and Discard were exercised at 390px; these remain presentation-only.
- Repo popover measured x=12px, width=360px, y=72px, height=688.6875px at 390x844, fully inside the viewport.
- Additional 390x420 check: independent editor scrolling reached 131px; Repo popover scrolling reached 349px. No document horizontal overflow or runtime errors were observed.
- Four existing interaction/routing tests passed; latest automatic preview build passed.

Changed application files: `src/routes/index.tsx`, `src/components/jam/EditorSlot.tsx`, `src/components/jam/RepoPopover.tsx`, `src/components/ui/popover.tsx`, and `src/styles.css`. Supporting changes: `AGENTS.md`, `roadmap.md`, this report, and the standing UI-batch memory.

The same tokens, fonts, sample song, linked highlight and preview descriptions are preserved. Engine, audio implementation, synchronization, Git behavior, backend, dependencies and build configuration are unchanged. Safe-area and dynamic-height CSS are implemented; physical mobile browser chrome, virtual keyboard and nonzero device safe-area insets were not tested.