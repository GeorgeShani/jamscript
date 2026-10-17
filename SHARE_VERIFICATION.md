# Share and example collaborator verification

## Scope and evidence

Inspection confirmed no real session URL/state or connected presence: the existing Share button only emitted an unconditional success toast, and NK/GS were static initials. PRODUCT.md describes intended collaboration, not an implemented session. There was no real sharing behavior to preserve. Existing playback and Repo's local preview content remain unchanged.

Share now opens the existing non-modal Popover with “Share Night bus”, a labeled read-only Preview URL field and outline Copy link. The URL is read from the current page when opened; no session ID, persistence or network request is created. Helper text explicitly says: “This opens the UI preview. Shared editing is not connected yet.” No second-tab, invitation or collaborator management action is offered.

Clipboard writes happen only from Copy link. The button is disabled while awaiting the write. A successful write emits Link copied; rejection or a missing clipboard API exposes the persistent alert “Couldn't copy the link. Select and copy it from the field.” The field remains focusable and selectable for manual copying.

Repo and Share use one route-owned toolbar popover state. Opening either closes the other; outgoing focus restoration is suppressed during handoff, so the incoming popover keeps focus. Repo's existing review handoff remains intact. Escape and outside click close Share and return focus to its trigger. URL field receives focus when opened; Tab reaches Copy link.

NK and GS remain synthetic examples, with hover and keyboard-focus tooltips “Example collaborator NK” and “Example collaborator GS”. Focusable spans add no management action or menu. Both initials retain their sans badge typography, 28px dimensions and track-6 / track-5 rings; measured overlap is exactly 8px. No names, online counts, connectivity states or cursor activity were introduced.

## Verification

- 32 automated tests pass across sharing, Takes, shared reviews, editor previews and routing. Clipboard tests assert no write on opening, exact current URL, no success before promise resolution, disabled in-flight action, rejected/missing API handling and keyboard-focusable avatars.
- Native headless Chromium clipboard write succeeded with browser clipboard permissions. Read-back matched the exact current page URL, and Link copied appeared only after the operation. This verifies the local browser flow, not clipboard permissions on every deployed browser.
- Browser failure presentation was exercised by replacing the clipboard write with a rejected NotAllowedError promise. The manual-copy alert appeared. This is an explicit simulated rejection, not a claim that a real browser permission denial was reproduced.
- Keyboard Enter opens Share, URL field is focused, Tab reaches Copy link, Escape returns to Share. Outside click also returns focus. Repo→Share and Share→Repo leave only one popover and focus the incoming content.
- Both example tooltip descriptions were observed on keyboard focus and fresh-page pointer hover. Escape dismisses a tooltip; a fresh pointer entry was used for hover verification rather than assuming Escape must immediately reopen it.
- Layout checked at 1280×720, 1920×1080, 390×844 and 390×420. Share is viewport-contained and document width equals viewport width. Screenshots under `/tmp/browser/share/` include success, failure and viewport states. Source text remains unchanged and no runtime errors were observed.
- Tokens, two fonts, shared Button/Popover/Tooltip states, amber focus and existing reduced-motion zero-duration rules are preserved. No CSS palette, package, build configuration, engine, audio, synchronization, Git implementation or backend changes.

## Still disconnected / unverified

Session creation, shared editing, BroadcastChannel, Yjs, WebSockets, invites, permissions, login and collaborator management remain absent. NK/GS are examples only. Physical-device safe areas, virtual keyboards and clipboard behavior in all deployed browsers remain unverified.