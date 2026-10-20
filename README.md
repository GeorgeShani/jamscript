# JamScript

Code is the source. Lenses are how you play it.

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

`bun run build:desktop-web` produces static workbench-only assets in `dist/desktop`, without the public site or its route. `bun run desktop:build` packages these assets in the Tauri v2 app, which opens and saves user-selected folders. Local desktop work needs no account; configured JamScript sign-in unlocks private shared workspaces. Do not package the Cloudflare Worker or the marketing site into the desktop shell.

## Desktop releases

The [Desktop workflow](.github/workflows/desktop.yml) verifies the project and builds Windows, macOS (Apple Silicon), and Linux installers on pull requests and pushes to `main`. These builds are retained as GitHub Actions artifacts for maintainers. A push of a `v*` tag publishes the installers to **this repository's** GitHub Release only after all platform builds pass. The tag must match `v` plus `src-tauri/tauri.conf.json`'s version. Ordinary pushes and pull requests never publish a release. An existing tag can be rebuilt through the workflow's manual `release_tag` input without moving the tag.

The workflow uses the repository-scoped `GITHUB_TOKEN`; only the release job receives `contents: write`. No release PAT or `RELEASES_TOKEN` is needed. The canonical repository, release archive, API, and asset URL base are stored in [`src/marketing/desktop-release-config.json`](src/marketing/desktop-release-config.json). The marketing site's Download section offers only assets in the latest stable release. The unsigned macOS DMG from `v0.1.0` was removed after macOS refused to open it. The separate [macOS preview workflow](.github/workflows/macos-preview.yml) can build an ad-hoc signed Apple Silicon DMG from an existing tag and publish it as a clearly labeled prerelease; prereleases are not offered by the site's stable Download section.

Public macOS releases require a paid Apple Developer membership, a **Developer ID Application** certificate, and notarization credentials. Configure these repository Actions secrets before running the normal tag or manual release build: `APPLE_CERTIFICATE` (base64-encoded exported `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` (the full Developer ID Application identity), `APPLE_API_ISSUER`, `APPLE_API_KEY` (App Store Connect key ID), `APPLE_API_PRIVATE_KEY` (the downloaded `.p8` contents), and `KEYCHAIN_PASSWORD` (a strong temporary CI keychain password). The normal release workflow refuses to publish without them, then checks the app with `codesign`, `spctl`, and `stapler`. Keep private keys out of Git and chat. The ad-hoc signed macOS preview still requires the user to override Gatekeeper; it is not a substitute for notarization. Windows installers are currently unsigned and can trigger SmartScreen; signing and real-device smoke tests are still needed before calling every platform production-ready.

To publish a version, update `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` to the same version, refresh and commit `src-tauri/Cargo.lock`, push to `main`, then create and push its matching `v` tag (for example, `v0.2.0`). Wait for all three desktop package jobs and the release job to pass. Do not tag a commit before its installers have been validated.

Installer branding is configured in `src-tauri/tauri.conf.json`: NSIS has separate installer/uninstaller icons and header artwork, WiX uses its banner and welcome-dialog artwork, and the macOS DMG has a branded background. The raster assets live in `src-tauri/installer/`; `python scripts/generate-brand-surfaces.py` regenerates them and `public/brand/og-image.png` (Pillow required). `python scripts/generate-brand-wordmark.py` regenerates the outlined Semibold wordmark and transparent lockup PNG (fonttools and Pillow required). The marketing page uses the 1200×630 PNG for Open Graph and large Twitter/X cards. Both the website and desktop app bundle Schibsted Grotesk and Martian Mono from `src/assets/fonts/`, so their typography also works offline.

Browser workspaces work without an account. Clerk sign-in uses browser-safe `VITE_CLERK_PUBLISHABLE_KEY` and Worker-only `CLERK_SECRET_KEY`. This project is linked to the selected Clerk application; after CLI login, `npx -y clerk@latest env pull` writes development keys into ignored `.env.local`. Private shared projects require Worker-only `DATABASE_URL` and `LIVEBLOCKS_SECRET_KEY` for metadata and per-document identity tokens. Set `APP_ORIGIN` for invitation links. To email invitations, configure server-only `RESEND_API_KEY` and `MAIL_FROM` (or `RESEND_FROM`). Use a verified Resend domain in production; while testing, `JamScript <onboarding@resend.dev>` works. If mail is unconfigured or delivery fails, the owner receives a manual invitation link and a safe configuration or delivery message. The invitation remains valid for seven days unless the owner revokes it. `VITE_LIVEBLOCKS_PUBLIC_KEY` is optional for intentionally public rooms. Gemini proposals use Worker-only `GEMINI_API_KEY`; `SUPABASE_SECRET_KEY` is optional for privileged server operations. See `.env.example` and `UI_IMPLEMENTATION_PLAN.md`. Store secrets in Cloudflare Worker secrets, never in `VITE_` variables or Git. Configure auth redirect URLs in their dashboards as well.

Desktop collaboration uses a **public Clerk OAuth application** with Device Authorization Grant, configured for `openid profile email offline_access`. The user approves its code in the system browser; the desktop app stores OAuth credentials in the OS keychain and sends only authenticated requests for shared projects and private Liveblocks rooms through its native bridge. Set `JAMSCRIPT_CLERK_OAUTH_CLIENT_ID`, `JAMSCRIPT_CLERK_FRONTEND_API_URL` (the HTTPS Clerk Frontend API origin), and `JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN` (the HTTPS Worker origin) in the build environment. For GitHub Actions releases, put these three **public** values in repository **Variables** with the same names. The Worker still needs its private Clerk, database, and Liveblocks configuration. If Clerk has not enabled Device Authorization Grant for your instance, request access from Clerk; local desktop folders remain usable meanwhile. Invitation links open the browser for acceptance, then the desktop Shared with you list can be refreshed. Never put a Clerk secret or Liveblocks secret in desktop variables.

The in-app sign-in and sign-up dialogs use JamScript's name and logo. Apple's consent page in Clerk's development instance uses Clerk's shared Apple OAuth application, so its "Clerk Development & Staging Instances" wording is expected there. A JamScript-branded Apple consent page needs app-owned Apple OAuth credentials configured in Clerk's Apple social connection; production requires those custom credentials.

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

The shared database helper accepts an optional Cloudflare `HYPERDRIVE_FRESH` binding. Provision a Hyperdrive configuration against this database with **query caching disabled**, then add its real ID to `wrangler.jsonc` under `hyperdrive` with `binding: "HYPERDRIVE_FRESH"` and redeploy. Use Cloudflare's [Supabase connection instructions](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/) for its origin connection. Keep the current server-only `DATABASE_URL` configuration for route availability checks and fallback. No Hyperdrive resource has been provisioned or deployed by these code changes.

With Hyperdrive, the helper enables prepared statements; the existing Supabase transaction-pooler fallback disables them. Both paths disable automatic array-type discovery because this schema has no PostgreSQL array columns. See [Cloudflare's Postgres.js driver configuration](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/) and [cache-disabled configurations for permissions](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/). Connection pooling remains active when query caching is disabled. Keep SQL clients scoped to each Worker request.

After the Ireland migration, the 20 October local probe measured 0.98–1.14 seconds for the first connection, 109–238 ms per warm round trip, and 0.08–0.09 ms for PostgreSQL execution of the workspace-list query. These samples identify network/connection overhead; they do not establish a production latency guarantee.

Document listing, active invitations and owner workspace-name lookup each authorize within one query instead of two. Member listing checks access and joins accepted-invitation emails in one query instead of three. Browser and desktop share panels load members and invitations through one authenticated management request and one database connection. Authorization results are not cached. The desktop HTTP agent reuses connections across API calls.

Remaining priorities are completing the production Ireland cutover, activating Hyperdrive, and measuring authenticated deployed requests through `Server-Timing`. The Liveblocks authorization route still loads the Clerk profile and requests a Liveblocks token after its permission query; those external-service times need a separate authenticated trace. Desktop browser approval uses Clerk OAuth polling, not Supabase: the app follows the native retry delay, checks on window focus/visibility resume, and distinguishes approval received from profile verification.

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
