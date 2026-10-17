# Rework preview verification

## Confirmed scope

Inspection found only a canned local review, not a real Rework implementation. The previous form attached arbitrary requests to a fixed bass-and-hats diff. No working model, validation or apply implementation was replaced.

The bar now exposes Rework preview, Preview proposal and one named example request: “Busier hats, keep the kick.” Selecting the example fills the input and focuses it; submitting opens the fixed proposal. Matching ignores surrounding whitespace and letter case only. Blank/whitespace-only requests cannot submit; other text receives the specified unavailable message without opening a canned answer.

The shared review is titled Example proposal, retains Example diff, and discloses “Example only. No request was sent and no checks were run.” Its two literal rows change hats from four to eight hits with the same gain; no bass or kick change is included. Parses, Plays and Keeps what you asked are normally Not checked, each with an icon and text. Passed, failed, pending and unavailable are fixture props only. Accept change remains disabled in every fixture, with a visible disconnected-check/apply explanation.

No model calls, keys, backend, parsing, evaluation, preservation checking, patching, timers, source edits or audio operations were added. Pending is a static clock icon, not a spinner or simulated progress. Typed requests live independently of the review, so Discard and Escape preserve them.

## Verification

- Vitest covers whitespace rejection, exact named-sample recognition, arbitrary requests, explicit sample selection, fixed hats-only rows, request preservation, immutable song/Takes, fixture status values, disabled apply for every fixture, review replacement and timer-free pending dismissal. Existing Repo, Share, Takes, lens and shared-review tests are run alongside it.
- Chromium verified empty/whitespace and arbitrary requests; sample selection and submission; all three Not checked rows; disabled Accept; Discard preserving input and returning focus to submit; Enter submission and Escape returning focus to input; topmost Share dismissal before proposal dismissal; Repo review replacing rather than stacking the proposal.
- Chromium confirmed no POST requests during the flow, unchanged rendered song and current Take, and Play continuing to display Stop while the proposal opens and closes, followed by Stop returning to Play. This verifies UI playback continuity, not audible output.
- Checked 1280×1800, 1920×1080, 811×679, 390×844, 375×667 and 390×420. Normal bar stays 48px at every measured size; unavailable feedback can grow the bar without document overflow. Input, sample and submit stay contained; the proposal exactly occupies the editor and its body scrolls locally to the check rows on short screens. Footer dismissal and disabled apply remain visible.
- Screenshots inspected for desktop, 375px, short 390px proposal and scrolled check rows. No browser runtime errors. Existing approved fonts, tokens, icons, focus treatment, secondary outline submit, panel geometry and reduced-motion behavior are preserved. The index route retains its app-specific metadata.

## Later validation/apply handoff — not implemented

1. A request callback must distinguish generated results, unavailable service and errors, with actual cancellation and stale-result handling. No credentials or service setup belongs in this UI batch.
2. A parser-validation callback must establish Parses from the actual proposed source; fixture status is never proof.
3. A safe dry-run/audio-validation callback must establish Plays without interrupting the current good playback.
4. A preservation callback must establish Keeps what you asked against the request and exact source snapshot, including unchanged kick for this sample.
5. A source-version-aware apply callback must refuse stale or unsafe proposals, apply only a proven change through the engine's transaction/undo path, and coordinate real Takes. Only confirmed validations plus a real safe apply callback may ever enable Accept.
6. Discard/cancel must abort or detach pending real work and prevent later results reopening a closed/replaced review. This preview has no presentation timers to cancel.

Audible output, physical-device safe areas and virtual keyboards remain unverified; real Rework generation, validation and application remain unavailable.