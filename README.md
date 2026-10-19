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

## Database foundation

The future synced-workspace backend has a [Drizzle schema](src/db/schema.ts) and generated PostgreSQL migrations in `drizzle/`. They cover workspaces, owner/editor/viewer memberships, documents with source versions, hashed invitations, and saved source revisions. Clerk user IDs are external references; the database stores no passwords. The `jamscript` schema is private and must stay out of Supabase's exposed API schemas. The read-only `/api/shared-workspaces` route requires a verified Clerk session and queries only that user's memberships; it returns no document source. It requires a server-only `DATABASE_URL` and a migrated database. Browser IndexedDB remains the active storage path until sync is implemented.

Use `bun run db:generate --name=<change>` after editing the schema and `bun run db:check` to check migration history. To apply migrations to a chosen PostgreSQL database, set a server-only `DATABASE_URL` and run `bun run db:migrate`. Use a Supabase database connection string, not its publishable API key. No live database has been migrated by this repository setup.

## Project documents and notices

- [PRODUCT.md](PRODUCT.md): product direction and current capabilities.
- [DESIGN.md](DESIGN.md): visual system and compact editor rules.
- [UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md): current workbench and backend rollout.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): longer product roadmap.
- [PRODUCT_PLAN.md](PRODUCT_PLAN.md): product rationale and preserved history.
- [AGENTS.md](AGENTS.md): development boundaries.

Built on [Strudel](https://strudel.cc/) with locally copied [audiocn](https://www.audiocn.dev/) controls. JamScript is [AGPL-3.0-or-later](LICENSE). Runtime attributions and copied-component attribution are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt); the full audiocn text is in [public/licenses/audiocn-MIT.txt](public/licenses/audiocn-MIT.txt). After lockfile changes, run `bun run licenses` to refresh the source and public notices. Sample packs retain their own licenses.

Before pushing this detached build to the formerly connected repository, disconnect GitHub in Lovable's Project settings → Git → GitHub. Preserve published Git history.
