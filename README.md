# JamScript

Code is the source. Lenses are how you play it.

JamScript is a live-coding music workbench built on [Strudel](https://strudel.cc). Write code, hear it instantly, and shape it with knobs and step grids that edit the source for you. It runs in the browser, on your phone and as a desktop app, and your music stays plain, readable code. **Top 10 at Hacktoberfest Georgia 2026.**

Use JamScript at [jamscript.dev](https://jamscript.dev) or get the [desktop app](https://github.com/GeorgeShani/jamscript/releases/latest). Desktop sign-in and collaboration connect to the same website.

JamScript serves a public product site at `/` and a browser music workbench at `/app`. Create an app-managed workspace, edit multiple documents, set BPM, play the active source, and inspect supported track parameters and actual output. Workspaces autosave in this browser's IndexedDB. Desktop folder editing, initial shared projects, and reviewed assistant edits are implemented; assistant availability requires server configuration.

## Development

Use Node.js 24 and Bun with the committed `bun.lock`.

```sh

bun install --frozen-lockfile

bun run dev

bun run test

bunx tsc --noEmit

bun run lint

bun run build

bun run build:desktop-web

bun run preview

```

Open the URL printed by Vite; `/app` opens the workspace chooser directly. Browser audio starts after a user gesture and may need access to external sample hosts. The production web build uses TanStack Start's Cloudflare Workers integration, server-rendering the public page and keeping the browser-dependent `/app` route client-rendered. `bun run cf-typegen` generates Worker types; `bun run deploy` deploys after Cloudflare credentials are configured.

Because `wrangler.jsonc` declares the Hyperdrive binding, `bun run dev` and `bun run preview` need a local Postgres connection string to emulate it. Set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_FRESH` in the ignored `.env.local` to a session-mode (port 5432) Supabase connection string; see `.env.example`. Never commit it.

`bun run build:desktop-web` produces static workbench-only assets in `dist/desktop`, without the public site or its route. `bun run desktop:build` packages these assets in the Tauri v2 app, which opens and saves user-selected folders. Local desktop work needs no account; configured JamScript sign-in unlocks private shared workspaces. Do not package the Cloudflare Worker or the marketing site into the desktop shell.

## Desktop releases

The [CI/CD workflow](.github/workflows/desktop.yml) checks types, lint, tests, and the web build on pull requests, pushes to main, and version tags. Pull requests only verify and build; they cannot deploy or publish. Pushes to main deploy the verified web artifact to [jamscript.dev](https://jamscript.dev), then check the landing page, workspace chooser, desktop connection page, licenses, and signed-out API boundary. Public browser build settings come from wrangler.jsonc; server secrets remain in Cloudflare. Artifact uploads explicitly exclude local environment and Worker development-secret files.

Version-tag runs publish Windows EXE/MSI, Apple Silicon macOS DMG, and Linux AppImage/DEB installers only after the website deployment, live checks, and every platform build pass. Bumping `version` in `src-tauri/tauri.conf.json` to an unpublished version and pushing to main also publishes installers automatically, creating its version tag at that exact verified commit. Pushes with an existing version keep its published installers; pull requests never publish. Only installer artifacts are downloaded into the release job. Explicit tags must match the desktop version and point to the current main commit, preventing an old tag from rolling back the website. The manual release_tag input rebuilds an existing release without redeploying the website or moving its tag.

One-time deployment setup: create a Cloudflare API token using the Edit Cloudflare Workers template, scoped to the JamScript account and jamscript.dev zone, and save it as the production environment secret CLOUDFLARE_API_TOKEN in GitHub (a repository Actions secret also works). Set the repository variable CLOUDFLARE_ACCOUNT_ID to the account ID. The production deploy job alone receives these credentials; it reuses existing Worker secrets. Rotating app secrets remains a separate Cloudflare operation, so production database and AI credentials are not copied into test jobs.

Production deployments are serialized. New main pushes and pull-request updates supersede outdated runs; tagged and manual release runs are not canceled by newer pushes. To roll back, revert the problematic commit on main and push the revert through the same checks; do not move published tags or deploy an older tag over a newer website.

The same deploy job publishes the tiny `jamscript-www` Worker using `wrangler.www.jsonc`. Its managed custom domain creates the `www.jamscript.dev` DNS mapping and HTTPS certificate. Every request, including static assets, returns a permanent 308 redirect to `https://jamscript.dev` with its path and query intact. Live deployment checks verify these redirects as well as the main app.

The release job uses the repository-scoped `GITHUB_TOKEN`; only that job receives `contents: write`. No release PAT or `RELEASES_TOKEN` is needed. The canonical repository, release archive, API, and asset URL base are stored in [`src/marketing/desktop-release-config.json`](src/marketing/desktop-release-config.json). The marketing site's Download section offers only assets in the latest stable release. The unsigned macOS DMG from `v0.1.0` was removed after macOS refused to open it. The separate [macOS preview workflow](.github/workflows/macos-preview.yml) can build an ad-hoc signed Apple Silicon DMG from an existing tag and publish it as a clearly labeled prerelease; prereleases are not offered by the site's stable Download section.

Current desktop releases use ad-hoc signing on macOS and unsigned Windows installers. macOS and Windows may show security warnings on first launch. macOS notarization requires a paid Apple Developer membership and Developer ID credentials; these demo builds are not notarized. Test installers on real devices before treating every platform as production-ready.

To publish a version, run `bun run desktop:version patch` (or `minor`, `major`, or an explicit stable version). The command checks and updates `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the app entry in `src-tauri/Cargo.lock` together, leaving dependency versions untouched. Add `--dry-run` to preview a bump, or run `bun run desktop:version --check` to check consistency. Commit the version changes and release notes, then push to `main`; CI creates the matching tag and publishes the installers after validation. No separate tag push is needed. Wait for all three desktop package jobs and the release job to pass.

Installer branding is configured in `src-tauri/tauri.conf.json`: NSIS has separate installer/uninstaller icons and header artwork, WiX uses its banner and welcome-dialog artwork, and the macOS DMG has a branded background. The raster assets live in `src-tauri/installer/`; `python scripts/generate-brand-surfaces.py` regenerates them and `public/brand/og-image.png` (Pillow required). `python scripts/generate-brand-wordmark.py` regenerates the outlined Semibold wordmark and transparent lockup PNG (fonttools and Pillow required). The marketing page uses the 1200×630 PNG for Open Graph and large Twitter/X cards. Both the website and desktop app bundle Schibsted Grotesk and Martian Mono from `src/assets/fonts/`, so their typography also works offline.

Browser workspaces work without an account. Clerk sign-in uses browser-safe `VITE_CLERK_PUBLISHABLE_KEY` and Worker-only `CLERK_SECRET_KEY`. This project is linked to the selected Clerk application; after CLI login, `npx -y clerk@latest env pull` writes development keys into ignored `.env.local`. Private shared projects require Worker-only `DATABASE_URL` and `LIVEBLOCKS_SECRET_KEY` for metadata and per-document identity tokens. Set `APP_ORIGIN` for invitation links. To email invitations, configure server-only `RESEND_API_KEY` and `MAIL_FROM` (or `RESEND_FROM`). Use a verified Resend domain in production; while testing, `JamScript <onboarding@resend.dev>` works. If mail is unconfigured or delivery fails, the owner receives a manual invitation link and a safe configuration or delivery message. The invitation remains valid for seven days unless the owner revokes it. `VITE_LIVEBLOCKS_PUBLIC_KEY` is optional for intentionally public rooms. The assistant uses Worker-only `OPENROUTER_API_KEY`; `SUPABASE_SECRET_KEY` is optional for privileged server operations. See `.env.example` and `UI_IMPLEMENTATION_PLAN.md`. Store secrets in Cloudflare Worker secrets, never in `VITE_` variables or Git. Configure auth redirect URLs in their dashboards as well.

Ask and Edit use separate ordered OpenRouter model lists, configured with `OPENROUTER_ASK_MODELS` and `OPENROUTER_EDIT_MODELS` (comma-separated provider/model IDs). Ask defaults to GPT-6 Luna → Claude Sonnet 5.5 → Gemini 3.8 Flash; Edit starts with GPT-6 Sol and uses the same backups. OpenRouter handles automatic model/provider fallback before the response begins. Once Ask text has streamed, JamScript reports an interruption rather than appending another model's answer. Edit requires structured JSON and retains file authorization, source freshness, syntax validation, and explicit review before applying changes. Requests have a 90-second upstream timeout, existing rate limits, and bounded output. Credit exhaustion, invalid keys, and provider unavailability produce separate messages without exposing upstream details. OpenRouter credits are required for these paid models. Desktop calls the same Worker endpoints and never receives provider keys.

Desktop collaboration uses a **public Clerk OAuth application** with Device Authorization Grant, configured for `openid profile email offline_access`. The user approves its code in the system browser; the desktop app stores OAuth credentials in the OS keychain and sends only authenticated requests for shared projects and private Liveblocks rooms through its native bridge. Set `JAMSCRIPT_CLERK_OAUTH_CLIENT_ID`, `JAMSCRIPT_CLERK_FRONTEND_API_URL` (the HTTPS Clerk Frontend API origin), and `JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN` (the HTTPS Worker origin) in the build environment. For GitHub Actions releases, put these three **public** values in repository **Variables** with the same names. The Worker still needs its private Clerk, database, and Liveblocks configuration. If Clerk has not enabled Device Authorization Grant for your instance, request access from Clerk; local desktop folders remain usable meanwhile. Invitation links open the browser for acceptance, then the desktop Shared with you list can be refreshed. Never put a Clerk secret or Liveblocks secret in desktop variables.

The in-app sign-in and sign-up dialogs use JamScript's name and logo. Apple's consent page in Clerk's development instance uses Clerk's shared Apple OAuth application, so its "Clerk Development & Staging Instances" wording is expected there. A JamScript-branded Apple consent page needs app-owned Apple OAuth credentials configured in Clerk's Apple social connection; production requires those custom credentials.

## Assistant chat

The assistant uses shadcn/ui Message Scroller, Message, Bubble, and Input Group components with JamScript styling. Conversations have local searchable history, rename and confirmed deletion, Markdown export, message/code copying, edit-and-resend branches, retry, cancellation, workspace-file attachments, and Ask/Edit model selection. Both Inspector and Assistant right panes support pointer/keyboard resizing and expand/restore views. The assistant retains its conversation and draft while expanding. New chat and History are labeled controls at the top. Each History row has a trash action with confirmation; deleting another conversation preserves the open chat and draft. The conversation menu also offers rename, export, copy, and confirmed deletion. Mode help is available on hover or keyboard focus. Responses render GitHub-flavored Markdown, tables, and highlighted JavaScript/TypeScript/Strudel code; executable HTML and unsafe links are blocked. A selected model becomes the first choice; the server retains the configured fallback allowlist. Editing an earlier prompt preserves its original conversation as a separate chat. The full transcript stays on the device; requests send only the latest bounded conversation context. Voice, web browsing, image analysis, and public chat sharing are not part of this interface.

## Email templates

Workspace invitations use `emails/workspace-invitation.mjml`. Run `bun run emails:build` after editing it; strict MJML validation compiles the source to the committed `invitation-email.generated.json`. Web development, tests, and production builds run this step automatically. The Worker sends the compiled HTML alongside the plain-text version through Resend, with escaped workspace names, recipient details, and invitation links. MJML itself is a development dependency and does not run in the Worker.

Run `bun run emails:preview` to create `dist/email-preview/workspace-invitation.html` with example content. Preview generation does not send an email. Clerk authentication emails remain managed by Clerk.

## Workbench

The chooser offers a new workspace and an explicit Night bus template. The Files sidebar creates, renames and deletes documents; tabs retain each open CodeMirror instance, including cursor and undo history. Play evaluates the active document. BPM uses four beats per cycle by default, so 120 BPM writes `setcps(0.5)` when that call has a supported, unambiguous syntax. Tempo settings can change this display interpretation per document and show the source CPS without changing playback speed. The Inspector writes supported parameters through the checked patcher. The Output panel's audiocn meter and spectrum read actual Strudel output.

Browser workspaces do not request filesystem permissions. Clearing this site's browser storage deletes the local workspaces. JamScript manages workspaces independently of Git; native folder operations and optional Git integration are reserved for the desktop app. Repo, Takes, Rework, presence, Share, and AI controls return only after their backing services work.

Playback prepares sample buffers and General MIDI soundfonts before starting the scheduler, scanning up to 64 cycles and 128 distinct assets with six concurrent loads. Later, unseen assets in open-ended patterns still load on demand. Stop cancels preparation immediately and fades existing audio over 350 ms; restarting cancels the old fade. Evaluation errors still mute immediately.

### IntelliSense and assistant checks

Browser and desktop editors share an offline JavaScript/Strudel language worker powered by TypeScript's language service. It provides inferred local/object types, standard JavaScript members, completion documentation, signatures, definitions (`F12`), references (`Shift+F12`) and local symbol rename (`F2`). `Ctrl+Space` opens suggestions; `Ctrl+Shift+Space` opens parameter hints. The catalog comes from the installed Strudel packages; signatures remain permissive for dynamic patterns. Navigation covers documents currently open in the language service, not a full disk/project import index.

Run `bun run language:generate` after upgrading Strudel or TypeScript to refresh the API catalog and bundled standard libraries. Analysis stays in a worker and never evaluates music. The editor/lens parser remains separate.

Run `bun run language:audit` to check the installed packages' distinct JSDoc examples against the real language service, without its 40-diagnostic display limit. Add `--json` to list every excluded example and its runtime requirement. The current audit covers 416 examples; 26 require optional MIDI/OSC extensions, external REPL widgets, or a custom runtime-registered method. These exclusions are explicit test fixtures, not IDE diagnostic suppressions.

The generator separates global and method signatures, follows pattern-returning source expressions and aliases, and discovers numbered controls, operators and distortion factories. Regression tests compile every catalogued signature, check all globals/methods/constructors are declared, and exercise representative chains plus invalid arguments. Undocumented utilities keep opaque types rather than inventing return values; the audit proves compatibility of the covered examples, not every possible JavaScript program.

Remote sample banks use [Strudel's sample-map syntax](https://strudel.cc/learn/samples/), including GitHub shortcuts:

```js
samples("github:eddyflux/crate");

s("bd sd hh sd").bank("crate");
```

The shortcut defaults to `main`; append a branch if needed. Sample names come from the bank's `strudel.json` (`crate_bd`, or `bd` with `.bank('crate')`). Audio downloads are cached and reused; manifests refresh after one minute, with cached fallback when the network fails. A changed URL or version query loads a new asset. Temporary download failures get one retry with a ten-second timeout per attempt. Samples still load on first use, so a new sound can arrive after its first trigger. Public web hosts must permit CORS; desktop's isolated cache bridge remains restricted to GitHub raw content, jsDelivr and strudel.cc, with eight active downloads, 32 queued requests, a 12 MiB file limit and 128 MiB cache limit.

`bun scripts/check-agent-live.ts` tests real Gemini Ask/Edit requests against the local dev server using synthetic music; pass a different origin as the final argument to test a deployment. It consumes model requests and never writes project files. Deterministic HTTP-handler, proposal safety, streaming retry, review/apply and undo coverage runs with `bun run test`.

Ask returns explanations and copyable code examples without file-writing actions. Edit proposes changes to existing files for review and explicit application. Both modes receive bounded references from the same Strudel parameter and return declarations used by IntelliSense, plus syntax diagnostics for the selected source. This context does not execute music or verify audio at runtime.

## Database foundation

The future synced-workspace backend has a [Drizzle schema](src/db/schema.ts) and generated PostgreSQL migrations in `drizzle/`. They cover workspaces, owner/editor/viewer memberships, documents with source versions, hashed invitations, and saved source revisions. Clerk user IDs are external references; the database stores no passwords. The `jamscript` schema is private and must stay out of Supabase's exposed API schemas. The read-only `/api/shared-workspaces` route requires a verified Clerk session and queries only that user's memberships; it returns no document source. It requires a server-only `DATABASE_URL` and a migrated database. Browser IndexedDB remains the active storage path until sync is implemented.

Use `bun run db:generate --name=<change>` after editing the schema and `bun run db:check` to check migration history. To apply migrations to a chosen PostgreSQL database, set a server-only `DATABASE_URL` and run `bun run db:migrate`. Use a Supabase database connection string, not its publishable API key. The application data was migrated from Sydney to Ireland on 20 October 2026; see the region migration instructions below.

### Region migration

The Sydney-to-Ireland copy was verified on 20 October 2026: 4 workspaces, 6 memberships, 4 documents, 7 invitations, 4 revisions, and 3 migration-history records. IDs, exact timestamps, row checksums, constraints, indexes, ownership and access grants match. The old database was left unchanged. Clerk accounts and Liveblocks rooms retain their existing IDs.

Use the server-only `DATABASE_URL_OLD` and `DATABASE_URL`, with matching `VITE_SUPABASE_URL_OLD` and `VITE_SUPABASE_URL`, from ignored local environment files. The migration command defaults to read-only preflight; `--apply` only imports into an empty destination. `--verify` compares both databases without changing them:

```sh
bun --env-file=.env --env-file=.env.local scripts/migrate-supabase-region.ts --verify
```

The command validates TLS against Supabase's public root certificate in `scripts/certs/`, sourced from the certificate URL in [Supabase Studio's configuration](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json). It never logs credentials, invitation details or music source, and copies data in one destination transaction with checksum verification before commit.

Production cutover is separate: update the Worker's private `DATABASE_URL` to Ireland, update any database binding, and redeploy with the new public Supabase settings. Local `.env` changes do not update deployed Worker secrets. Prevent shared-workspace writes during final cutover and verify again; later writes to the old project do not automatically replicate to Ireland.

### Database latency diagnostics

Run a read-only probe (prints timings/counts, never credentials, IDs or music):

```sh

bun --env-file=.env --env-file=.env.local scripts/check-database-performance.ts

```

`/api/shared-projects` GET responses expose `Server-Timing` for `auth` and `database`. The database duration includes connection setup, driver protocol exchanges, query waiting and cleanup; it is not Postgres execution time. Use the diagnostic's `EXPLAIN ANALYZE` result to distinguish server execution from network overhead.

On 20 October 2026, this machine measured 2.6–3.6 seconds to connect to the configured Sydney (`ap-southeast-2`) database, 0.38–0.64 seconds per warm network round trip, and 0.08–2.7 ms for the workspace-list query inside Postgres. The membership and workspace/document indexes are present. These are local-to-database measurements, not a production Worker trace or an end-to-end sign-in benchmark.

The shared database helper uses the Cloudflare `HYPERDRIVE_FRESH` binding when it exists. The production configuration `jamscript-fresh` (ID in `wrangler.jsonc`) has query caching **disabled** and points at the Supabase **session-mode pooler** (port 5432). Do not use the transaction pooler (port 6543) as the Hyperdrive origin: the helper enables prepared statements with Hyperdrive, and that pooler rejects them, which made every shared-database query fail with a 500 until the origin port was corrected. Create or change the configuration with `npx wrangler hyperdrive create|update`, keeping `--caching-disabled` (membership revocation and read-after-write must reach Postgres immediately). `wrangler.jsonc` also enables Smart Placement and Workers observability. Keep the server-only `DATABASE_URL` secret for route availability checks and as the non-Hyperdrive fallback; verify a deployment through `Server-Timing` on `/api/shared-projects`.

With Hyperdrive, the helper enables prepared statements; the existing Supabase transaction-pooler fallback disables them. Both paths disable automatic array-type discovery because this schema has no PostgreSQL array columns. See [Cloudflare's Postgres.js driver configuration](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/) and [cache-disabled configurations for permissions](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/). Connection pooling remains active when query caching is disabled. Keep SQL clients scoped to each Worker request.

After the Ireland migration, the 20 October local probe measured 0.98–1.14 seconds for the first connection, 109–238 ms per warm round trip, and 0.08–0.09 ms for PostgreSQL execution of the workspace-list query. These samples identify network/connection overhead; they do not establish a production latency guarantee.

Document listing, active invitations and owner workspace-name lookup each authorize within one query instead of two. Member listing checks access and joins accepted-invitation emails in one query instead of three. Browser and desktop share panels load members and invitations through one authenticated management request and one database connection. Authorization results are not cached. The desktop HTTP agent reuses connections across API calls.

Remaining priorities are measuring authenticated deployed requests through `Server-Timing` now that Hyperdrive is active, and loading only the active shared file's source when opening a workspace (it currently returns every file's source). The Liveblocks authorization route runs its permission query and the Clerk profile lookup in parallel, then requests a Liveblocks token; those external-service times need a separate authenticated trace. Desktop browser approval uses Clerk OAuth polling, not Supabase: the app follows the native retry delay, checks on window focus/visibility resume, and distinguishes approval received from profile verification.

21 October measurements and optimizations: `bun run perf:database` runs read-only probes, including three alternating before/after comparisons. It prints timings and row counts without credentials, user identities or document contents. On this machine, the Ireland connection took 1,134 ms to open and warm network round trips took 204–205 ms; the workspace-list SQL itself took 0.107 ms. The existing indexes are used, so adding more indexes would not address the observed connection delay.

| Path measured locally                                | Before         | After          | Change                                                                                      |
| ---------------------------------------------------- | -------------- | -------------- | ------------------------------------------------------------------------------------------- |
| Share management queries, same open connection       | 818–921 ms     | 323–410 ms     | Members and invitations in one authorized SQL statement; no members × invitations expansion |
| Shared AI database reads, including connection setup | 2,545–2,868 ms | 1,229–1,536 ms | Ask/Edit and legacy proposal routes use the existing joined workspace-open query once       |

These are database-path measurements on a small existing workspace, not end-to-end AI generation or production latency guarantees. Membership is checked on every request; private responses and authorization results are not cached. The diagnostic retains the previous read paths for comparison. Before Hyperdrive, every new Worker request paid the cross-region connection handshake; the figures above predate it. Provisioning Hyperdrive requires an authenticated Cloudflare account; changing local environment files alone does not provision it or update the deployed Worker.

## Performance notes

- **Playback scheduling.** Strudel's scheduler runs on the main thread (100 ms tick, 0.2 s lookahead), so editor work competes with it. Playback highlights are batched into one editor update per 50 ms window and skipped in hidden tabs; live re-evaluation while dragging controls runs at most every 100 ms; the sample pre-scan yields on an 8 ms budget; samples for newly added sounds start loading during live edits; and the audio context uses the `playback` latency hint, which trades a little output latency for fewer underruns.
- **Bundle size.** Every browser script is under 500 kB except the language-server worker (`strudel.worker`, about 6.5 MB), which contains the TypeScript compiler as a single module. The assistant panel and the Liveblocks/Yjs binding load on demand, and the generated Strudel API reference has its own server chunk. Do not split Worker vendor code by size: that broke the production Worker at startup. The legacy `@google/genai` Gemini path is a single 1.1 MB server module.
- **Caching.** `GET /api/agent-chat` returns static deployment configuration and is cacheable for five minutes in the browser. All other collaboration responses stay `private, no-store`.

## Audio controls in the IDE

The Inspector mixer uses audiocn dB faders and mute/solo controls while storing linear gain in workspace settings. Inline audiocn knobs and literal pan controls edit the same CodeMirror source through checked patches and undo; typed changes still apply with Ctrl/Cmd+Enter. Dynamic expressions stay editable in code.

During playback, Output can show Spectrum, frequency Bars or an actual Waveform. The desktop bridge supplies bounded waveform frames and honestly reports its combined meter as mono. Track faders remain unavailable for combined routing such as Coastline's post-stack effects and programs with authored `orbit`/`duck` routing. Those programs retain their original buses; declared duck targets are prepared before the first note.

Opening a workspace prepares the audio runtime without evaluating its code or starting music. Play waits for assets in the opening two cycles, then prepares later sections in the background. Cached assets are reused on subsequent starts; a first download or decode can still delay an uncached opening sound.

Open **Sounds** from the activity bar (or the **Samples** tab in the bottom panel); the banks load automatically. Search, choose a **Bank**, or use **Show all** to reach every registered sound, and copy a sound's code from the preview. Play a song first to register its custom sample packs, then press **Refresh**. Filter and tap a Sound Pad to audition without replacing your song. Choose a variant, seek its decoded waveform or adjust preview volume; number shortcuts work only with focus inside the pad grid. **Replace selected sound** only replaces an editable single literal sound selected in the editor, with undo. It rejects pattern strings and banked expressions. See the [implementation roadmap](IMPLEMENTATION_PLAN.md) for remaining audio work.

## Contributors

- [Luka Vacheishvili](https://github.com/lukavache)

## Project documents and notices

- [PRODUCT.md](PRODUCT.md): product direction and current capabilities.

- [DESIGN.md](DESIGN.md): visual system and compact editor rules.

- [UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md): current workbench and backend rollout.

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): longer product roadmap.

- [PRODUCT_PLAN.md](PRODUCT_PLAN.md): product rationale and preserved history.

- [AGENTS.md](AGENTS.md): development boundaries.

Built on [Strudel](https://strudel.cc/) with locally copied [audiocn](https://www.audiocn.dev/) controls. JamScript is [AGPL-3.0-or-later](LICENSE). Runtime attributions and copied-component attribution are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt); the full audiocn text is in [public/licenses/audiocn-MIT.txt](public/licenses/audiocn-MIT.txt). After lockfile changes, run `bun run licenses` to refresh the source and public notices. Sample packs retain their own licenses.

Before pushing this detached build to the formerly connected repository, disconnect GitHub in Lovable's Project settings → Git → GitHub. Preserve published Git history.
