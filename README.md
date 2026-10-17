# JamScript

Code is the source. Lenses are how you play it.

JamScript is a browser music workbench built around a live Strudel editor. Create an app-managed workspace, edit multiple documents, set BPM, play the active source, and inspect supported track parameters and actual output. Workspaces autosave in this browser's IndexedDB. Native folders, collaboration, AI proposals, and Strudel IntelliSense are later milestones.

## Development

Use Node.js 24 and Bun with the committed `bun.lock`.

```sh
bun install --frozen-lockfile
bun run dev
bun run test
bunx tsc --noEmit
bun run lint
bun run build
bun run preview
```

Open the URL printed by Vite. Browser audio starts after a user gesture and may need access to external sample hosts. The production build uses TanStack Start's Cloudflare Workers integration. `bun run cf-typegen` generates Worker types; `bun run deploy` deploys after Cloudflare credentials are configured. Tauri will receive a separate desktop build.

Browser workspaces work without an account. Clerk sign-in uses browser-safe `VITE_CLERK_PUBLISHABLE_KEY` and Worker-only `CLERK_SECRET_KEY`. This project is linked to the selected Clerk application; after CLI login, `npx -y clerk@latest env pull` writes development keys into ignored `.env.local`. Future synced workspaces use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for storage; private collaboration uses Worker-only `LIVEBLOCKS_SECRET_KEY` to mint per-document identity tokens. `VITE_LIVEBLOCKS_PUBLIC_KEY` is optional for intentionally public rooms. Gemini proposals use Worker-only `GEMINI_API_KEY`. Set `APP_ORIGIN` for invitation and auth redirects; `SUPABASE_SECRET_KEY` is optional for privileged server operations. See `.env.example` and `UI_IMPLEMENTATION_PLAN.md`. Store secrets in Cloudflare Worker secrets, never in `VITE_` variables or Git. Configure auth redirect URLs in their dashboards as well.

## Workbench

The chooser offers a new workspace and an explicit Night bus template. The Files sidebar creates, renames and deletes documents; tabs retain each open CodeMirror instance, including cursor and undo history. Play evaluates the active document. BPM uses four beats per cycle by default, so 120 BPM writes `setcps(0.5)` when that call has a supported, unambiguous syntax. The Inspector writes supported parameters through the checked patcher. The Output panel's audiocn meter and spectrum read actual Strudel output.

Browser workspaces do not request filesystem permissions. Clearing this site's browser storage deletes the local workspaces. JamScript manages workspaces independently of Git; native folder operations and optional Git integration are reserved for the desktop app. Repo, Takes, Rework, presence, Share, and AI controls return only after their backing services work.

## Project documents and notices

- [PRODUCT.md](PRODUCT.md): product direction and current capabilities.
- [DESIGN.md](DESIGN.md): visual system and compact editor rules.
- [UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md): current workbench and backend rollout.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): longer product roadmap.
- [PRODUCT_PLAN.md](PRODUCT_PLAN.md): product rationale and preserved history.
- [AGENTS.md](AGENTS.md): development boundaries.

Built on [Strudel](https://strudel.cc/) with locally copied [audiocn](https://www.audiocn.dev/) controls. JamScript is [AGPL-3.0-or-later](LICENSE). Runtime attributions and copied-component attribution are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt); the full audiocn text is in [public/licenses/audiocn-MIT.txt](public/licenses/audiocn-MIT.txt). After lockfile changes, run `bun run licenses` to refresh the source and public notices. Sample packs retain their own licenses.

Before pushing this detached build to the formerly connected repository, disconnect GitHub in Lovable's Project settings → Git → GitHub. Preserve published Git history.
