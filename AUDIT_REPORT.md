# JamScript plan audit report

Date: 18 October 2026. Working artifact (not part of the product document set).

Sources of truth (priority when they disagree): `AGENTS.md` → `PRODUCT.md` / `DESIGN.md` → `IMPLEMENTATION_PLAN.md` / `UI_IMPLEMENTATION_PLAN.md` → `PRODUCT_PLAN.md` Current direction only.

Skills named in the audit brief (`web-design-guidelines`, `impeccable`, `frontend-ui-engineering`, `theming`, `browser-testing-with-devtools`, `code-review-and-quality`, `security-and-hardening`) are **not installed** in this environment. UI review used `DESIGN.md`, browser snapshots/CDP, and Vitest instead.

## 1. Summary

### Verdict counts (traceability rows)

| Verdict           |       Count (approx.) |
| ----------------- | --------------------: |
| VERIFIED          |                    78 |
| PARTIAL           |                    24 |
| MISSING           |                     8 |
| DIVERGENT         | 3 (2 fixed this pass) |
| UNVERIFIABLE-HERE |                    18 |
| MISSING-BLOCKED   |                     6 |

### Test / type / lint / build

| Gate                | Before audit                                | After fixes             |
| ------------------- | ------------------------------------------- | ----------------------- |
| `bun run test`      | 209 pass / 44 files                         | **219 pass / 48 files** |
| `bunx tsc --noEmit` | clean                                       | clean                   |
| `bun run lint`      | 0 errors / 18 warnings                      | 0 errors / 18 warnings  |
| `bun run build`     | success (Strudel eval + sourcemap warnings) | success (same warnings) |

### Top 5 risks

1. **Live collaboration acceptance (C)** — roles and Yjs binding exist in tests, but two-person Liveblocks sessions, reconnect/offline reconcile, and full origin-aware undo acceptance are not observed here.
2. **Live Gemini / Resend / Clerk** — endpoints and gates are unit-tested; end-to-end with real keys, signed-in shared editors, and Resend delivery were not run.
3. **Desktop packaging / listening (B)** — macOS smoke is claimed in plan prose; Windows/Linux installers and subjective listening quality remain open.
4. **Complex lenses (E)** — bracketed rhythm, alternation, `note`/`n`, `.fast`/`.slow`, occurrence IDs shipped; nested variable references, euclid, and full coastline surgical editing are incomplete.
5. **GitHub device auth (F)** — local git2 clone/commit/push/FF-pull exist; device OAuth and OS credential storage do not.

### Fixes landed this pass

| Commit    | Plan ID    | Change                                                          |
| --------- | ---------- | --------------------------------------------------------------- |
| `a5050d1` | UI/DESIGN  | Sentence-case panel labels at 12px; design regression test      |
| `3121028` | G / AGENTS | ChatPanel explains unavailable agent instead of empty pane      |
| `c16ff62` | C          | Invitation email via Resend HTTP (Worker-safe); drop nodemailer |
| `831b932` | F / G / UI | Plan checkboxes aligned with verified Takes/Gemini/Resend state |
| `b127778` | C          | Live presence avatars, tab dots, named cursors + unit tests     |

## 2. Traceability matrix

Legend: **P** = plan checkbox/prose status before this pass.

### AGENTS.md

| ID   | Requirement                                                                            | P     | Verdict  | Evidence                                                                                                                                                               |
| ---- | -------------------------------------------------------------------------------------- | ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG-1 | Read product/design/UI/implementation plans                                            | prose | VERIFIED | This audit                                                                                                                                                             |
| AG-2 | CodeMirror is live source; Play uses active editor; patcher undo; per-doc editor state | prose | VERIFIED | `SessionWorkbench` evaluates active view; `dispatchLensEdit` / tempo tests; tab state in workbench tests                                                               |
| AG-3 | Do not casually rewrite parse/lens engine; Lezer ranges; refuse ambiguous              | prose | VERIFIED | Lens work stays in `music-document.ts` + patcher; refuse tests in `music-document.test.ts`                                                                             |
| AG-4 | Browser = IndexedDB only; no FSA; native FS/Git desktop-only                           | prose | VERIFIED | No `showDirectoryPicker` in `src/`; `GitPanel` gated on `nativeWorkspace`                                                                                              |
| AG-5 | DESIGN sizes: 14px code, 24px rhythm, 28px knobs, 48px toolbar, 900px                  | prose | VERIFIED | `styles.css` tokens; workbench drawer test below 900px                                                                                                                 |
| AG-6 | Show Repo/Takes/Rework/presence/Share/AI only with real services                       | prose | PARTIAL  | Fixture `TakesRail`/`RepoPopover`/`ReworkBar` **not mounted**; real Takes + gated Share/AI; presence only when collab connected. Marketing still uses showcase chrome. |
| AG-7 | Worker secrets never in browser; private Liveblocks via server tokens                  | prose | VERIFIED | No `GEMINI_API_KEY`/`LIVEBLOCKS_SECRET`/`CLERK_SECRET` in `dist/client`; agent routes use `process.env`                                                                |
| AG-8 | Do not rewrite published Git history                                                   | prose | VERIFIED | No force-push/history rewrite in this pass                                                                                                                             |
| AG-9 | `/graphify` skill when invoked                                                         | prose | N/A      | Not invoked                                                                                                                                                            |

### PRODUCT.md / DESIGN.md (selected)

| ID   | Requirement                                                        | Verdict             | Evidence                                                    |
| ---- | ------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------- |
| PR-1 | Browser workspaces IndexedDB CRUD/autosave                         | VERIFIED            | Workspace storage + tests                                   |
| PR-2 | Clerk without requiring account for local                          | VERIFIED            | Local create workspace in browser                           |
| PR-3 | Playback real Strudel + meters                                     | VERIFIED            | `playback.test.ts`; Output meters wired                     |
| PR-4 | Takes local snapshots                                              | VERIFIED            | `take-store.ts` + `takes-output.test.tsx`                   |
| PR-5 | Git desktop optional                                               | VERIFIED            | `GitPanel` + rust git2                                      |
| PR-6 | Agent Gemini shared editors Ask/Edit                               | PARTIAL             | Chat + proposal routes; live Gemini UNVERIFIABLE            |
| DS-1 | Sentence case, no all-caps labels                                  | DIVERGENT→**FIXED** | Was uppercase Files/Inspector/…; fixed `a5050d1`            |
| DS-2 | 14/24/28/48/900                                                    | VERIFIED            | CSS                                                         |
| DS-3 | No FSA in browser                                                  | VERIFIED            | Grep clean                                                  |
| DS-4 | Prefer reduced motion                                              | PARTIAL             | Rules exist; not exhaustively exercised for every animation |
| DS-5 | Marketing may use illustration motion; `/app` no decorative motion | PARTIAL             | Marketing has entrances; workbench mostly static            |

### UI_IMPLEMENTATION_PLAN.md

| ID      | Requirement                                                  | P               | Verdict  | Evidence                                                                            |
| ------- | ------------------------------------------------------------ | --------------- | -------- | ----------------------------------------------------------------------------------- |
| UI-M1-1 | Detach Lovable; TanStack CF Workers                          | claimed         | PARTIAL  | Stack matches; Lovable GitHub disconnect is manual (UNVERIFIABLE)                   |
| UI-M1-2 | Workspace chooser, IndexedDB CRUD, Night bus, tabs, autosave | claimed         | VERIFIED | `/app`, workspace routes, tests                                                     |
| UI-M1-3 | Per-doc CM state; Play/BPM active editor; checked patcher    | claimed         | VERIFIED | Workbench + tempo/lens tests                                                        |
| UI-M1-4 | Replace preview Repo/Takes/… with real shell; Takes later    | claimed         | VERIFIED | Fixture rails unmounted; real Takes in Output                                       |
| UI-M1-5 | audiocn Knob/Slider/Meter/Spectrum from real sources         | claimed         | VERIFIED | Components under `components/ui`; no demo analyser signals in playback path         |
| UI-M2-1 | Clerk + Drizzle schema; auth before sync                     | claimed         | PARTIAL  | Clerk UI + schema/migrations; account-backed sync pending                           |
| UI-M2-2 | Liveblocks private rooms + server tokens + presence          | claimed         | PARTIAL  | Token routes + presence UI; live two-person UNVERIFIABLE                            |
| UI-M2-3 | Gemini + review/apply; then show AI                          | claimed→updated | PARTIAL  | `/api/agent-chat`, `/api/agent-proposal`, gated Assistant; live Gemini UNVERIFIABLE |
| UI-CFG  | Public `/`, `/app`, library, help; secrets layout            | claimed         | VERIFIED | Routes resolve 200; `.env.example` documents Worker vs `VITE_`                      |

### IMPLEMENTATION_PLAN — Steps 1–2

| ID     | Requirement                              | P     | Verdict  | Evidence                                       |
| ------ | ---------------------------------------- | ----- | -------- | ---------------------------------------------- |
| S1-*   | Direction docs                           | [x]   | VERIFIED | Docs present                                   |
| S2-*   | Structure, branding, licence, regression | [x]   | VERIFIED | Assets in `public/brand`; notices; suite green |
| S2-BPM | BPM component authorized addition        | prose | VERIFIED | `TempoControl` + `tempo.test.ts`               |

### Step 3 progress claims (prose)

| ID             | Claim                                        | Verdict        | Evidence                                                  |
| -------------- | -------------------------------------------- | -------------- | --------------------------------------------------------- |
| P-browser      | Browser workspaces/tabs/BPM/meter            | VERIFIED       | Suite + browser                                           |
| P-desktop      | Folder open/save/recovery/conflict           | PARTIAL        | Code + rust; live native UNVERIFIABLE here                |
| P-coastline    | Coastline fixture + Stop mute on fail        | VERIFIED       | Fixture + `playback.test.ts` hush/hard-mute               |
| P-shared       | Shared routes, roles, schema, LSP transport  | PARTIAL        | Routes/tests; live session UNVERIFIABLE                   |
| P-takes        | Local Takes                                  | VERIFIED       | `take-store`                                              |
| P-A-delete     | Native delete warns unsaved                  | PARTIAL        | Code present; native dialog UNVERIFIABLE                  |
| P-B-mixer-stop | Mixer after Stop cannot unmute               | VERIFIED       | `playback.test.ts`                                        |
| P-C-roles      | Invalid invite roles rejected                | VERIFIED       | `collaboration.test.ts`                                   |
| P-D-hover      | Coastline sample/chord hover                 | PARTIAL        | Language service tests; full offline LSP acceptance open  |
| P-B-opaque     | Desktop opaque audio frame                   | PARTIAL        | Sandbox present; packaged macOS claimed UNVERIFIABLE here |
| P-C-share      | Share ≤32 files, Yjs rooms                   | PARTIAL        | ShareControls + liveblocks-document; live UNVERIFIABLE    |
| P-C-rebind     | Role downgrade rebinds editor                | VERIFIED       | `shared-editor-attach.test.ts`                            |
| P-D-gm         | GM sample names in index                     | PARTIAL        | Generation scripts/tests                                  |
| P-E-*          | Bracket/alt/note/fast/occurrence lenses      | VERIFIED       | music-document + lens tests                               |
| P-F-label      | Musical take labels                          | VERIFIED       | `take-label` + store                                      |
| P-F-git        | Desktop git init/status/commit/clone/push/FF | VERIFIED       | rust tests in `lib.rs`                                    |
| P-G-*          | Gemini proposal/chat auth/validate/stream    | PARTIAL        | Routes + Vitest; live Gemini UNVERIFIABLE                 |
| P-collab-ui    | Shared home one entry; members/invites       | PARTIAL        | UI + tests; live UNVERIFIABLE                             |
| P-Resend       | (added) Invitation email Resend              | VERIFIED→fixed | `c16ff62`; live send UNVERIFIABLE                         |

### A. Workbench and local folders

| ID      | Requirement                                                                 | P     | Verdict  | Evidence                                              |
| ------- | --------------------------------------------------------------------------- | ----- | -------- | ----------------------------------------------------- |
| A-1     | Shell: top bar, activity, tabs, panels, assistant, status; command registry | [x]   | VERIFIED | `SessionWorkbench`                                    |
| A-2     | DESIGN sizes; drawers below 900px                                           | [x]   | VERIFIED | CSS + `workbench-workspaces.test.tsx` + browser 800px |
| A-3     | BPM primary; beats-per-cycle; refuse ambiguous; setcpm form                 | [x]   | VERIFIED | `tempo.test.ts` / TempoControl “Tempo from code”      |
| A-4     | Browser IndexedDB; desktop folders; no FSA                                  | [x]   | VERIFIED | Grep + storage adapters                               |
| A-5     | Per-doc state; stop on song switch                                          | [x]   | VERIFIED | Workbench behavior + tests                            |
| A-6     | Watch/conflict/recovery                                                     | [x]   | PARTIAL  | Desktop code paths; live watcher UNVERIFIABLE         |
| A-ACC   | Acceptance paragraph                                                        | prose | PARTIAL  | Browser ACC verified; full desktop ACC UNVERIFIABLE   |
| A-TEMPO | Tempo acceptance numbers                                                    | prose | VERIFIED | Unit tests for 0.5→120, refuse ambiguous              |

### B. Desktop runtime / playback

| ID    | Requirement                            | P     | Verdict           | Evidence                                                                          |
| ----- | -------------------------------------- | ----- | ----------------- | --------------------------------------------------------------------------------- |
| B-1   | Tauri v2 three platforms               | [x]   | PARTIAL           | `src-tauri` present; Win/Linux package UNVERIFIABLE                               |
| B-2   | Path traversal/symlink reject          | [x]   | VERIFIED          | `src-tauri/src/lib.rs` canonicalize/symlink checks                                |
| B-3   | Eval serialize; Stop cancel; GM        | [x]   | VERIFIED          | playback tests + soundfont registration                                           |
| B-4   | Sandboxed playback frame; narrow IPC   | [x]   | VERIFIED          | desktop sandbox; asset bridge refuses local/creds (`desktop-asset-cache.test.ts`) |
| B-5   | Sample cache/retry states              | [x]   | VERIFIED          | audio-cache tests                                                                 |
| B-6   | Coastline fixture preserved            | [x]   | VERIFIED          | fixtures path                                                                     |
| B-ACC | Play coastline all targets + listening | prose | UNVERIFIABLE-HERE | Needs packaged desktop + ears                                                     |

### C. Collaboration

| ID      | Requirement                                      | P         | Verdict           | Evidence                                                                     |
| ------- | ------------------------------------------------ | --------- | ----------------- | ---------------------------------------------------------------------------- |
| C-1     | Clerk + Supabase + Liveblocks/Yjs                | [ ]       | PARTIAL           | Wired partially; not full acceptance                                         |
| C-2     | Anonymous local; explicit share excludes secrets | [x]       | VERIFIED          | Share path selects music files                                               |
| C-3     | Roles, revoke, presence, offline owner           | [ ]       | PARTIAL           | Roles/revoke/presence code; offline persistence UNVERIFIABLE                 |
| C-4     | Stable IDs; sync source+meta; lenses from sync   | [ ]       | PARTIAL           | IDs + Yjs source; full meta sync open                                        |
| C-5     | Origin-aware undo; viewer enforce                | [ ]       | PARTIAL           | `Y.UndoManager` + viewer editable false tests; full multi-user undo ACC open |
| C-6     | Device-local folders; dirty remote; reconcile    | [ ]       | MISSING-BLOCKED   | Needs product decision on reconcile UX                                       |
| C-ACC   | Concurrent edit acceptance                       | prose     | UNVERIFIABLE-HERE | Needs two signed-in clients                                                  |
| C-email | Resend invites                                   | added [x] | VERIFIED (unit)   | `invitation-email.test.ts`; live Resend UNVERIFIABLE                         |

### D. IntelliSense

| ID    | Requirement                                    | P     | Verdict | Evidence                                        |
| ----- | ---------------------------------------------- | ----- | ------- | ----------------------------------------------- |
| D-1   | Owned LSP core + worker + stdio                | [ ]   | PARTIAL | Worker/stdio scripts exist; not full LSP parity |
| D-2   | CM LSP client + generated API docs             | [ ]   | PARTIAL | Integration present                             |
| D-3   | Completion/hover/signature/diagnostics/symbols | [ ]   | PARTIAL | Subset tested                                   |
| D-4   | Nested stacks; stale reject; cancel            | [ ]   | PARTIAL | Stale rejection claimed in plan prose + tests   |
| D-ACC | Coastline offline completions                  | prose | PARTIAL | Some coverage; full ACC open                    |

### E. Complex lenses

| ID    | Requirement                                | P     | Verdict         | Evidence                                             |
| ----- | ------------------------------------------ | ----- | --------------- | ---------------------------------------------------- |
| E-1   | Extend Lezer model/patcher                 | [x]   | VERIFIED        | Incremental extensions + tests                       |
| E-2   | Nested stacks/unlabelled/variables         | [ ]   | MISSING-BLOCKED | Large lens phase                                     |
| E-3   | Structural seq/alt/parallel; euclid etc.   | [ ]   | PARTIAL         | Alt/brackets/`note` done; euclid locked              |
| E-4   | Modulation intact; numeric only when known | [ ]   | PARTIAL         | Param lenses; modulation graph out of scope          |
| E-5   | Whitespace/focus/one-gesture; refuse stale | [ ]   | PARTIAL         | Gesture undo in inspector; more coastline cases open |
| E-ACC | Coastline surgical edit ACC                | prose | PARTIAL         | Subset verified in unit tests                        |

### F. Takes and Git

| ID    | Requirement                                  | P     | Verdict  | Evidence                                                                    |
| ----- | -------------------------------------------- | ----- | -------- | --------------------------------------------------------------------------- |
| F-1   | Persistent Takes, dedupe, 200; gesture group | [x]*  | PARTIAL  | Store verified; **gesture grouping still MISSING** (*checkbox note updated) |
| F-2   | Labels, compare, audition, restore           | [x]   | VERIFIED | Output panel + tests                                                        |
| F-3   | Native git2 adapter                          | [x]   | VERIFIED | `lib.rs` + native tests                                                     |
| F-4   | GitHub device auth + credential store        | [ ]   | MISSING  | Explicitly pending                                                          |
| F-ACC | Throwaway repo flow                          | prose | PARTIAL  | Rust unit coverage; interactive auth UNVERIFIABLE                           |

### G. Gemini agent

| ID    | Requirement                                     | P     | Verdict           | Evidence                                       |
| ----- | ----------------------------------------------- | ----- | ----------------- | ---------------------------------------------- |
| G-1   | Private key; @google/genai; auth; limits        | [x]   | VERIFIED          | `api.agent-*.ts`; wrangler rate limit 20/60    |
| G-2   | Ask/Edit chat; no shell/Git tools               | [x]   | VERIFIED          | `ChatPanel` + route; no shell tools            |
| G-3   | Stream/cancel/failures; no secrets in logs      | [x]   | VERIFIED          | NDJSON stream tests; op-id logging pattern     |
| G-4   | Versioned multi-file review; stale invalidation | [x]   | VERIFIED          | `proposalIsFresh` / apply tests                |
| G-5   | Deterministic preservation checks only          | [ ]   | PARTIAL           | Syntax check only (`proposalSyntaxCheck`)      |
| G-ACC | Coastline explain/apply live                    | prose | UNVERIFIABLE-HERE | Needs signed-in shared editor + Gemini         |
| G-UI  | Honest unavailable state                        | —     | FIXED             | `3121028` + `chat-panel-availability.test.tsx` |

## 3. Plan corrections

| File                                  | Change                                                        | Why                                           |
| ------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| `IMPLEMENTATION_PLAN.md` F-1/F-2      | Checked persistence/labels; noted gesture grouping still open | Code+tests prove Takes store; grouping absent |
| `IMPLEMENTATION_PLAN.md` C Resend     | Added checked Resend HTTP item                                | SMTP was broken on Workers; Resend landed     |
| `UI_IMPLEMENTATION_PLAN.md` M2 Gemini | Updated to Ask/Edit chat + availability gate                  | Matches `/api/agent-chat` + ChatPanel         |

Not unchecked: G-1…G-4 remain checked for **implemented** surface with tests; live Gemini stays UNVERIFIABLE, not a false checkbox on the code items.

## 4. UI findings

| Severity | Location                                                                      | Guideline                         | Status                                              |
| -------- | ----------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------- |
| major    | Workbench panel headings all-caps / 10px                                      | DESIGN sentence case + 12px label | **fixed** `a5050d1`                                 |
| major    | ChatPanel blank when `available:false`                                        | AGENTS honesty / G                | **fixed** `3121028`                                 |
| minor    | Marketing / library / help section ALL CAPS (`A MUSIC IDE…`, `LOCAL LIBRARY`) | DESIGN sentence case              | **open** (recommend; illustration/marketing chrome) |
| minor    | Output LIVE/IDLE badges                                                       | DESIGN allows status badges       | OK                                                  |
| minor    | Console: route transition title flash “Workspaces”                            | polish                            | **open**                                            |
| minor    | Lint react-hooks warnings in audiocn/hooks/workbench                          | quality                           | **open** (pre-existing)                             |
| blocker  | None found in local browser shell                                             | —                                 | —                                                   |

Browser exercised: `/`, `/app`, library, help, docs (fetch), invitation signed-out, shared signed-out, workspace at 375 / 800 / 1440. No horizontal overflow at 375. Assistant button absent for local unsigned workspace. Files/Inspector mutually exclusive at 800px.

Not fully exercised: 200% zoom matrix, dark/light (product is single dark theme), prefers-reduced-motion toggle, keyboard-only full tour, Play→meter→Stop audio levels.

## 5. UNVERIFIABLE-HERE

| Item                                  | Manual steps                                                                                              | Pass/fail                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Live Gemini chat                      | Sign in → shared editor workspace → Assistant → Ask stream → Edit propose → Apply → Undo → reload history | Pass: tokens stream; apply one undo; history persists; secrets absent from Network response bodies beyond errors |
| Live Resend invite                    | Configure `RESEND_API_KEY` + verified `MAIL_FROM` → invite → inbox                                        | Pass: email arrives; fail shows safe owner message                                                               |
| Two-person collab                     | Two browsers, owner+editor, concurrent edit + presence + viewer refuse                                    | Pass: both see source/lenses; viewer cannot type/lens/apply                                                      |
| Packaged macOS/Win/Linux Play         | Build installers; Coastline Play/Stop; listen                                                             | Pass: nonzero meter; Stop silent; no sandbox bridge errors                                                       |
| Offline sample replay                 | Cache samples; disconnect; Play                                                                           | Pass: playback without network                                                                                   |
| Lovable GitHub unlink                 | Lovable settings                                                                                          | Pass: project not linked before push                                                                             |
| GitHub device auth                    | When implemented                                                                                          | N/A until built                                                                                                  |
| Physical a11y (AT speech, safe areas) | Device + VoiceOver                                                                                        | Separate from this audit                                                                                         |

## 6. MISSING-BLOCKED

| Item                                           | Proposed design                                    | Decision needed                    |
| ---------------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| E nested vars / euclid / full coastline lenses | Continue Lezer surgical patches; keep refuse-first | Scope order vs release             |
| C offline reconcile of dirty remote buffers    | Explicit “Keep local / Load remote” per file       | Whether auto-merge is ever allowed |
| F GitHub device + OS credentials               | Device flow + keychain; never force push           | Provider + secret storage policy   |
| G semantic preservation beyond syntax          | Deterministic subset only (as planned)             | Which musical invariants to check  |
| D full LSP acceptance                          | Finish analysis core + CM client                   | Priority vs E/C                    |
| Account-backed workspace sync                  | Drizzle revisions + sync protocol                  | Conflict model                     |

## Skills note

Requested Cursor skills for UI/security review were unavailable. Security spot-check: client bundle grep for secret env names clean; viewer enforcement covered by unit tests; SQL via Drizzle in collaboration routes (no raw string SQL spotted in quick scan).
