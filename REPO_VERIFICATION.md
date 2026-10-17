# Repo preview verification

## Scope and confirmed behavior

The inspected Repo implementation was local React state only: it contained simulated clone progress, commit/push success and a mock token form. No working Git implementation was found or replaced. Engine, playback, source, Takes, Share, synchronization, backend, packages and build configuration are unchanged.

Repo now discloses that examples do not read or publish repositories. Clone immediately opens a labeled example, without fetching an address or simulating progress. Add, Add all, Remove and Commit operate on local preview state only. Commit works with no added changes and includes all example changes; added changes can be removed without discarding them. Blank messages and the busy fixture cannot commit. Preview commits use clearly synthetic identifiers and report only “Preview commit created.” History is capped at five entries.

Selecting ideas.js does not move the Open marker away from night-bus.js. Open selected file, Push to main and Pull are disabled with persistent explanations. No token, name or email is collected. The fixture for unsaved editor content explains why loading is blocked; the diverged fixture refuses pulling with the prescribed external-resolution explanation. There are no merge, overwrite or force-push actions.

## Verification performed

- Vitest: 50 tests across Repo, inline reviews, Share, Takes and lens previews passed. Repo coverage includes primary-action selection, implicit-all commit, Add/Remove, blank/busy/clean refusal, fixed Open marker, unavailable loading/publishing, immutable source/Take/fixtures and no fetch on Clone.
- Every Repo fixture renders in tests: no repo, clean, changed, ready, ahead, behind, busy, offline, token needed, token refused, diverged and unsaved editor. Non-default states are props only; no scenario menu, network progress or recovery timer exists.
- Chromium exercised Add all → Ready to commit → Remove → Changes → Ctrl+Enter commit → ahead. Commit is the only primary before committing; disabled Push to main is the only primary afterward. Primary selection for no-repo and clean states is covered by unit tests.
- Chromium verified file selection, fixed Open marker, disabled loading/publishing/Pull, no credential field, shared review handoff and heading focus, Escape returning to Repo, unchanged rendered source and current Take, and the preserved Play → Stop → Play lifecycle.
- Repo measured at 1280×1800, 1920×1080, 811×679, 390×844 and 390×420: width never exceeds 360px, viewport insets retained, no document horizontal overflow. The short-screen popover scrolls internally. Screenshots inspected for desktop, short mobile and post-commit states.
- No browser runtime errors; latest observed automatic build reports build OK. Only existing tokens, two approved fonts, lucide icons, shared button variants and floating-layer shadow are used; existing reduced-motion rules remain unchanged.

## Remaining integration points — outside Lovable UI work

1. A real Git working copy, clone/status/file enumeration, add/remove and commit callbacks. Replace synthetic fixtures and identifiers only once confirmed outcomes can be read back.
2. A safe-load callback that validates the selected song, refuses unsaved-editor overwrite and preserves document/Take/undo guarantees. Until then the Open marker remains fixed and loading unavailable.
3. Real comparisons routed through the shared inline renderer without applying them automatically.
4. Push/Pull integration, actual ahead/behind/busy/offline/error outcomes and refusal on divergence. No force-push, merge or silent overwrite.
5. Future identity and credential flow belongs to external development: name/email for real commits and a fine-grained GitHub token with Contents: Read and write, kept only in the intended browser/tab environment. Token input, validation and retries are not implemented or collected here.
6. Git networking/proxy, browser storage and persisted history are not implemented. No repository read, commit, upload, permission check or real offline recovery is verified by this UI preview.

Audible output, sample delivery and physical-device safe areas remain unverified, as before; successful Play/Stop UI lifecycle is not evidence of audible playback.