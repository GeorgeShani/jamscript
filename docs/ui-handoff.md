# JamScript UI handoff

## Local visual revision — 17 October 2026

After reviewing the published shell, the user selected a roomier code-first editor. The local export now implements that direction: 16px source on 32px rows, 36px rhythm cells and 44px knobs, a 72px desktop toolbar, clearer statement spacing, quieter Takes disclosures, and a larger Rework input. Phone controls and layout remain bounded to the viewport. Strudel attribution is now persistent in the footer rather than disappearing with the first-use strip. DESIGN.md's roomier editor revision supersedes the original dense dimensions.

Validation of this local revision:

- `bun run test`: all 7 files / 65 existing tests passed.
- `bun x tsc --noEmit`: passed.
- `bun run build`: passed, generating `.output/public` and the existing Nitro server output. Existing plugin/chunk warnings remain; no build configuration was changed.
- Browser inspection: 1440×900 desktop and 390×844 phone screenshots; layout measurements at 1280×720 and 1920×1080. Document width matched the viewport in every checked size. Play remained within the viewport. Desktop source, cell and knob sizes measured 16px, 36px and 44px respectively.
- Phone Take selection expanded the action row, Compare focused its heading, and the review remained contained. Closing returned focus; selection could be cleared. Browser error log was empty during the checked flows.
- The design detector reported only advisory palette/type-ramp findings: existing floating shadow literals and the new 16px step. The font step and existing shadow were documented in the DESIGN.md metadata; this is not a claim of a clean repeat detector run.

Music source, fixtures, playback adapter and engine behavior were not changed. Audible playback was not retested. This directory has no `.git` metadata: changes are local, with no push, Lovable sync or deployment performed. Original edited files were copied to a temporary backup before changes. The older acceptance record below describes the preceding Lovable version, not the revised local layout.

Acceptance date: 2026-10-17 UTC. This is the final presentation-only Lovable pass. `PRODUCT.md` and `DESIGN.md` remain verbatim development references, not app content. No engine, audio, synchronization, Git, backend, dependency, stack or build-configuration changes were made. No demonstrated shell defect required a UI patch.

## Acceptance evidence

Fresh Chromium checks exercised the existing UI at **1280×720, 1920×1080, 768×1024 and 390×844**. Screenshots were inspected. `bunx vitest run src/test` passed **7 files / 65 tests** at 14:32:51 UTC. The test command exited successfully; this is not an inferred result from the script name.

- Document width equalled viewport width at all four sizes. Play/Stop, Share, Takes and the Rework input stayed within the viewport. Narrow toolbar used two rows; bottom actions stayed accessible after selecting a Take.
- Existing code and literal diff lines scrolled locally at 390px: code line 5 had client/scroll widths 390/407 and scrolled 17px; comparison had 390/581 and scrolled 191px. Wider screens did not require horizontal scrolling. No fabricated long document was introduced.
- Compare filled the editor bounds exactly, focused its heading and made the covered editor inert. At 390px the review occupied x=0, y=73, width=390, height=610. A Share layer took the first Escape; the next dismissed the review and returned focus to Compare.
- Repo stayed at most 360px wide and within the viewport; its body scrolled locally. Repo-to-review closed the popover before focusing the review. Share/Repo were mutually exclusive. Escape returned focus to their triggers; clicking the uncovered Rework input dismissed Share and returned focus to Share.
- Six focus-linked sample ranges matched only their named tokens. Source-token focus and lens hover were exercised; the regression suite asserts literal mappings, independent pointer/focus state and no cross-link between identical numbers. Locked percussion retained its reason, dimmed presentation and inert cells.
- Bass cutoff arrow/Shift-arrow preview reached 1310 Hz without changing the source. A drum toggle changed only its preview. Original code and the current Take marker read back unchanged after all flows.
- Reduced-motion Share computed `animation-name: none` and `transition-duration: 0s`.
- Runtime page errors: **0**. POST requests during these flows: **0**. Playback evaluation/update log count stayed unchanged during previews.

Temporary browser scripts, logs and screenshots are under `/tmp/browser/final-ui/`, not shipped source or permanent attachments. Existing regression tests and prior `*_VERIFICATION.md` reports remain in the repository.

## Runtime, packages and commands

`package.json` is ESM and has **no root `engines` or `packageManager` declaration**. Installed package metadata requires Node **>=22.12.0** for TanStack Start; Vite/plugin-react/Nitro require `^20.19.0 || >=22.12.0`. Vitest supports `^20.0.0 || ^22.0.0 || >=24.0.0`. Use the observed **Node 22.22.0** baseline rather than assuming every later odd-numbered Node release is supported. Browser playback needs user-initiated Web Audio; this is not a Node audio process.

Observed package manager: **Bun 1.3.14**. `bun.lock` is present. `bunfig.toml` enables text lockfiles and a 24-hour release-age guard. No Bun minimum is declared. README's generic npm instructions are not a verified clean-install record.

| Installed package | Exact version | Major |
| --- | --- | --- |
| React / React DOM | 19.2.8 / 19.2.8 | 19 |
| TanStack Start / Router | 1.168.60 / 1.170.41 | 1 |
| TanStack Query | 5.101.4 | 5 |
| Vite | 8.1.5 | 8 |
| TypeScript | 5.9.3 | 5 |
| Tailwind CSS | 4.3.3 | 4 |
| Strudel Web | 1.3.0 | 1 |
| Nitro | 3.0.260603-beta | 3 beta |
| Lovable Vite/TanStack config | 2.26.5 | 2 |
| Vitest | 4.1.11 | 4 |
| Radix Popover | 1.1.23 | 1 |
| Sonner / Lucide React | 2.0.7 / 0.575.0 | 2 / 0 |

Versions above were read from installed package metadata, not inferred from manifest ranges. The full dependency inventory is in `package.json` and resolved lockfile.

```sh
bun install --frozen-lockfile
bun run dev
bun run build
bunx vitest run src/test
```

**Command evidence:** clean frozen install was not rerun during this no-dependency-change pass; it is the lock-preserving install command, not a claimed successful clean export install. The existing Vite dev server at `http://localhost:8080` served the verified flows. `dev` maps to `vite dev`; do not assume the sandbox's automatic port selection applies locally. `build` maps to `vite build`; current automatic production-build evidence is below. Tests were actually executed. `preview` maps to `vite preview`, but was not exercised and must not be advertised as a verified Cloudflare runtime preview. Lint, formatter and `build:dev` were not run.

## Actual paths

| Surface | Repository location |
| --- | --- |
| Editor route, viewport frame, toolbar, transport and error strip | `src/routes/index.tsx` |
| Root document, fonts, query provider, tooltip provider, toaster | `src/routes/__root.tsx` |
| Router / Start / server wrapper | `src/router.tsx`, `src/start.ts`, `src/server.ts` |
| Frame, toolbar breakpoints, typography, motion, token palette | `src/styles.css` |
| Code placeholder, tokenizer, LensStrip, LensShell, RhythmLens, Knob, LockedRhythm | `src/components/jam/EditorSlot.tsx` (these lens components are local functions, not separate files) |
| Sample source and fixed lens spans / track tokens | `src/components/jam/session.ts` |
| Existing browser playback adapter / declaration | `src/engine/playback.ts`, `src/engine/strudel-web.d.ts` |
| Takes / fixtures and literal comparisons | `src/components/jam/TakesRail.tsx`, `src/components/jam/take-fixtures.ts` |
| Share / synthetic presence | `src/components/jam/SharePopover.tsx`, `src/components/jam/ExampleAvatar.tsx` |
| Repo / fixtures and pure preview transitions | `src/components/jam/RepoPopover.tsx`, `src/components/jam/repo-fixtures.ts` |
| Rework / request and check fixtures | `src/components/jam/ReworkBar.tsx`, `src/components/jam/rework-fixtures.ts` |
| Shared ReviewPanel / literal rows and check types | `src/components/jam/InlinePanel.tsx`, `src/components/jam/review-fixtures.ts` |
| Shared controls and floating layers | `src/components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `popover.tsx`, `tooltip.tsx`, `sonner.tsx` |
| Regression tests | `src/test/*test.tsx`, setup in `src/test/setup.ts`, config in `vitest.config.ts` |
| Build configuration | `vite.config.ts` |

There is one content route, `/`, with app-specific title/description, Open Graph title/description/type and Twitter card in its own `head()`. No landing page, real source editor, Git module or collaboration module exists. `src/routeTree.gen.ts` is generated; do not hand-edit it.

## Capability table

| Interaction | Status | Observed evidence / limitation |
| --- | --- | --- |
| Play / Stop | **Real** adapter; audio **unverified** | Real Strudel evaluation accepted the fixed sample; Play→Stop→Play→Stop worked. Previews did not reevaluate it. No audible-output claim. |
| Sample delivery | **Unverified** | No `.wav`/`.mp3` dirt-samples responses captured; no claim that sample loading succeeded or failed. |
| Editing source, note highlighting, undo | **Disabled / absent** | Read-only rendered code, not CodeMirror. No source transaction or playing-note projection. |
| Linked tokens / rhythm / knob | **Preview** | Fixed mappings; local boolean/numeric states only. Arrow/Shift-arrow works. Knobs have no drag/type-value engine gesture path. |
| Locked percussion | **Preview lock** | Reason visible on focus/hover; Space/Enter did not change cells. |
| Takes selection / current | **Preview** | 19:43 selected independently of fixed current 19:44; both states retained. |
| Compare | **Preview** | Shared literal example rows, not a computed comparison with playing source. |
| Audition / Restore | **Disabled** | Disabled controls and persistent disconnected explanation; no capture on Play. |
| Share clipboard | **Real** browser operation | Native granted clipboard write succeeded and readback equalled current URL. Simulated API rejection showed manual-copy instructions; physical permission denial was not tested. |
| Shared editing / avatars | **Preview / absent** | Current preview URL only; NK/GS are disclosed examples, not live users. |
| Repo selection / Add / Remove / Commit | **Preview** | Fixed Open marker; local staging and keyboard preview commit worked; only “Preview commit created” reported. |
| Clone | **Preview** | No-repo prop fixture opens an example, not a clone. Covered by regression tests, not default-flow browser networking. |
| Repo file loading / Push / Pull | **Disabled** | Controls disabled; no safe-load, publishing, identity or credential path. |
| Repo exceptional states | **Preview** | Explicit clean/ready/ahead/behind/busy/offline/token/diverged/unsaved fixtures and pure transitions; not live Git status. Test coverage does not imply real failures were reproduced. |
| Rework requests / proposal | **Preview** | Blank refused; arbitrary request received unavailable message; only named hats sample opened a proposal. |
| Rework checks / Accept | **Disabled** | Three “Not checked” rows; Accept disabled even for passed fixture states (regression test). No validation/model/apply call. |
| Dismiss / focus / transient coordination | **Real UI behavior** | Heading focus, one review, topmost Escape, inert covered code and trigger focus return exercised. |

## Existing presentation seams and future integration tasks

The following are **existing signatures**, not proposed new infrastructure. Do not connect a callback by substituting a canned success.

- `EditorSlot({ panelOpen?: boolean })`: only accepts covered-state input. There is **no document/source/change callback**. Replace the read-only rendering with the authoritative engine editor and engine-derived projections. Internal `LinkHandler(id: LensKey | null, source: "pointer" | "focus" | "all")` handles relationships only; `LENS_SPANS` is not a safe patch map.
- Local `LensStrip({track, children})`, `LensShell({id,label,linked,onLink,introducing?,children})`, `RhythmLens({track,sounds,initial})`, `Knob({track,name,min,max,step,initial,format})`, `LockedRhythm({id,linked,onLink})`: props describe synthetic presentation. Rhythm and knob hold their own preview state; **no source mutation or gesture callback exists**. Engine must supply safe ranges, lock reasons, exact ranges, source-derived values and one-gesture undo transactions. Do not reuse linear preview bounds as musical ranges.
- Transport is an element and `onPlayToggle` inside `src/routes/index.tsx`, with no external source prop. Existing adapter exports `initPlayback()`, `play(code): Promise<boolean>`, `stop(): Promise<void>`, `onError(callback | null)`. Future integration must replace fixed `SAMPLE_CODE` with authoritative source/version, verify audible playback and error/last-good behavior; preserve browser-only loading.
- `TakesRail({fixture?: TakeFixture,onCompare(review,launcher)})`: fixture is data input, not a storage API; `onCompare` opens a static review. No capture/audition/restore callback exists. Engine must capture successful source snapshots, compute comparisons, audition safely and restore through a source transaction, with selection separate from current.
- `SharePopover({open,onOpenChange,suppressCloseFocus?})`: only open/focus coordination exists. There is **no session URL input**. Add a genuinely valid session URL handoff when sync exists, retaining awaited clipboard result handling. `ExampleAvatar({initials,ring})` has no presence subscription; replace it with real join-order identity/state, not cosmetic connectivity.
- `RepoPopover({onOpenDiff(launcher),open?,onOpenChange?,suppressCloseFocus?,fixture?})`: optional fixture initializes local preview state, not a live Git subscription. No clone/status/stage/commit/load/push/pull callbacks exist. Future Git integration needs real working-copy state, safe loading with unsaved-source refusal, computed review data, busy/error outcomes, external divergence resolution and browser-local identity/credentials. `ChangeRow` actions are local presentation closures. Never enable overwrite/merge/force-push.
- `ReworkBar({inputRef,onPreview(review,launcher)})`: no live-request callback exists. Add real request/cancel/stale-result handling separately; parser, safe dry-run and preservation checks must derive from the exact proposed source/request snapshot, not fixture status.
- `ReviewPanel({review: ReviewExample,onClose})`: accepts static rows/checks/comparison labels and close only. There is **no apply callback**. Introduce source-version-aware safe apply through the engine transaction/undo path only after real checks pass; coordinate real Takes. Discard must cancel pending work and block later reopening. Keep one route-owned active review and launcher focus target.
- Route-owned `toolbarPopover`, `panel`, `closeReview`, `reworkInput` coordinate presentation. Preserve popover exclusivity and outgoing focus suppression. Do not turn open/close into document edits.

## Retire synthetic state only when capabilities are real

`session.ts` owns immutable sample source, spans and track mappings; `EditorSlot.tsx` owns preview values and first-use guidance. The working transport also currently consumes that sample. Replace these deliberately with one authoritative engine document and projections; never let lens state own source. Keep a clearly separated demo fixture if a demo remains useful.

Replace `take-fixtures.ts` and `TAKE_COMPARISONS`, Repo fixture/transitions, `REWORK_FIXTURES`, and `REVIEW_EXAMPLES` with confirmed results, not generated-looking samples. Repo local `preview/selected/message/address/notice` and Rework `request/unavailable` are not stored session/Git/AI state. Fixture props alone do not enable actions. Remove “Example diff”, “Example proposal”, “Repo preview”, “Rework preview”, “Example Takes”, sample-avatar and disconnected-action disclosures **only for capabilities actually wired and verified**. Share's current-page preview wording must remain until it hands off a real shared session. First-use dismissal remains presentation state, separate from song data.

## Build and hosting facts

Latest automatic production log observed in `/tmp/observability/build-errors.log`:

```text
=== build 2026-10-17T14:34:32Z ===
build OK
```

The automatic production build completed successfully **after the handoff documentation was written**. A manual `bun run build` was not run because the environment prohibits manual production builds and runs them automatically. The recorded result is actual automatic-build evidence, not an inference from the script name. No UI/source changes were needed during this pass.

Sandbox `dist/` is **older output** from 13:32:35 UTC, not the 14:34 build artifact. Observed layout: `dist/client/` (~1.3 MiB) contains assets, `_shell.html`, `_headers`, favicon and robots; `dist/server/` (~1.5 MiB) contains `index.mjs`, chunks/runtime/SSR and generated `wrangler.json`; `dist/nitro.json` names publicDir `client`, serverEntry `server/index.mjs`, preset `cloudflare-module`. These sizes/paths describe the inspected older artifact only; fresh automatic-build artifacts were not exposed in that directory.

The generated worker config binds `ASSETS` to `../client` and names `index.mjs` as main. `vite.config.ts` enables SPA mode and uses the Lovable config's Nitro Cloudflare default. SPA mode **does not make this generated output a verified pure-static SPA**. There is no `dist/client/index.html` and no observed `_redirects` fallback. Static-only hosting would need a confirmed `/` entry and route fallback serving `_shell.html`, plus assets, and proof no required server behavior is lost; that deployment was not tested. The inspected output expects a Cloudflare module worker with asset binding. DESIGN's separate Pages editor/landing topology is planned, not an implemented two-site export. Do not upload `dist/client` blindly or rewrite configuration during this handoff.

No GitHub connection, export, push or deployment occurred during this pass. No tool exposed a current known-good **Lovable version ID**. Read-only Git HEAD observed after acceptance was `6ef63f21fc97b9b32c5a31fe26a0ff7dcc855ad0`; this is repository context, **not** a Lovable version or proof the handoff docs are exported. Use the project's existing history/export/deployment controls.

## Prioritized development backlog

1. **Authoritative source editor and playback verification:** real editor, snapshot/version ownership, audible output/sample delivery, startup/error/last-good behavior, user-gesture audio and device/browser checks. Replace temporary GitHub sample loading with verified self-hosted delivery before submission.
2. **Music IR and safe patcher:** derive projections; prove exact minimal edits, visibly refuse unsupported patterns, stale-version guards and transactional undo. Source text remains authoritative.
3. **Source-derived lenses and gesture undo:** real rhythm/parameter ranges, filter scaling, drag/type gestures, exact bidirectional mappings, lock reasons, one undo per gesture and truthful note highlighting attribution.
4. **Collaboration / presence:** actual source synchronization, conflict handling, session links and genuine presence. BroadcastChannel/Yjs in PRODUCT are plans, not installed capabilities.
5. **Successful-play Takes:** capture only confirmed successful source snapshots; real comparison, safe audition/back-to-live, safe restore, persistence and undo coordination.
6. **Optional Git:** real browser working copy, networking/proxy/persistence, status/staging/commit, safe loading, identity/credentials, verified push/pull and divergence refusal. See `REPO_VERIFICATION.md`.
7. **Optional checked Rework:** real requests, cancellation, actual Parses/Plays/Keeps checks, source-version-aware safe apply and discard/stale-result protection. See `REWORK_VERIFICATION.md`.

## Unresolved URLs, gaps and defects

- No genuine **JamScript source repository URL** was supplied. The example Repo address is not that URL. Supply a real Source link before submission; no URL was invented.
- Existing dismissible first-use notice links to **https://strudel.cc** and states AGPL-3.0-or-later. Strudel is installed at 1.3.0; this is not a legal-completeness or source-offer claim. Verify license notices/distribution obligations in the exported repository. Playing-note highlighting is not implemented; credit Strudel if its feature is later exposed.
- Audible sound, complete sample delivery, physical-device safe areas/virtual keyboards, native 200% browser zoom, real malformed-source recovery and exported Cloudflare/static deployment remain unverified. No WCAG score or compliance certification is claimed.
- Playback initialization rejection/retry and pending/stale transport behavior need engine verification; do not treat successful fixed-sample Play as proof every error path works.
- All non-default Git/Takes/check states are fixtures, not reproduced live-service conditions. Synthetic review rows are not actual document diffs.
- No demonstrated UI defect remained in this bounded pass. Unrelated default error/404 surfaces were not redesigned; no landing-page audit was performed.

## Changed files in this pass

- `docs/ui-handoff.md` — this factual acceptance and integration handoff.
- `roadmap.md` — final acceptance/handoff checklist.

No app source, engine file, package, build configuration or reference document changed. Core music behavior beyond fixed-sample playback remains repository development work; this pass stops here.
