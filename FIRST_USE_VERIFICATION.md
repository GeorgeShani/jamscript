# First-use UI capability audit

## Real behavior
- Play evaluates the immutable synthetic Night bus sample through the existing Strudel playback adapter; Stop hushes it. Loading and playback errors are already wired.
- Dismiss, linked highlights, keyboard value previews and rhythm-cell toggles are local presentation interactions.

## Preview only
- EditorSlot renders fixed sample text. Lens values/cells never rewrite it or change sound. Knobs respond to keyboard input; pointer dragging and typed-value editing are not implemented.
- Takes are fixed fixtures; Restore only shows a toast.
- Rework displays pending checks; Accept is disabled. The displayed diff is synthetic.
- Repo operations simulate local state; no GitHub calls occur. Share only displays a toast and does not copy a link. Avatars are synthetic, not synchronized presence.

## Changed application files
- `src/components/jam/EditorSlot.tsx`: truthful guidance, mount-only dismissal, static bass lpf introduction, persistent accessible control-preview description.
- `src/components/jam/session.ts`: comments distinguish immutable synthetic song and linked-highlight fixtures from editable document state.
- `src/test/editor-preview.test.tsx`: focus, mount-only dismissal, usable previews and immutable sample checks.

No engine, playback, Git, backend, package, design-token or build-configuration changes.

## Verification
- Four tests passed: route matching, initial focus, mount-only dismissal with usable cells, and keyboard value preview with byte-for-byte unchanged sample text.
- Browser checked at 1280, 1920, 555 and 375px. Guidance remains readable; Dismiss stays inside each viewport. The strip grows from 36px to 48px/68px on small screens.
- Initial focus remains on the page body. Bass lpf and its 1200 token have static cyan outlines, including reduced motion (zero transition duration). Interacting elsewhere removes the introduction.
- After dismissal, keyboard knob and rhythm previews remain usable and expose the persistent accessible description. Source text is unchanged. Reload restores the introduction.
- Play becomes Stop and Strudel logs its start; Stop becomes Play and Strudel logs its stop. No browser runtime errors were observed. No audio sample responses were captured, so sample delivery and audible output are **unverified** in this run; no audio implementation was changed.
- Existing shell limitations were preserved: code scrolls horizontally on narrow screens; static takes, Rework, Repo, Share and avatars remain previews, not working history, AI, Git, sharing or collaboration.

Supporting project files changed: `AGENTS.md`, `roadmap.md`, and this audit report; project memory records the UI-only boundaries. `PRODUCT.md`, `DESIGN.md`, `src/styles.css`, and all engine files are unchanged.