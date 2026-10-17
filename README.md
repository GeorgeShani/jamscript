# JamScript

Code is the source. Lenses are how you play it.

A Strudel music editor growing into a local-first desktop IDE with a collaborative browser companion. CodeMirror editing, source-derived rhythm/parameter controls, one undo history and playback from current editor text work today. Takes, Repo, presence and Rework are labeled examples. Native files, real collaboration, IntelliSense and Gemini assistance are pending.

## Development

Use Node.js 24 and Bun with the committed bun.lock. This cleanup was verified using Node 24.19.0 and Bun 1.4.0. Browser audio requires a user gesture and access to the referenced sample hosts.

```sh
bun install --frozen-lockfile
bun run dev
bun run test
bunx tsc --noEmit
bun run lint
bun run build
```

Open the development URL printed by Vite. The existing build uses TanStack Start and Nitro's Cloudflare target; do not assume its client directory alone is a deployable static desktop frontend. Tauri gets its own frontend build in a later slice.

Set tempo in the toolbar's BPM field. With four beats per cycle, 120 BPM writes `setcps(0.5)`. Valid edits apply after a short typing pause; Enter or leaving the field applies immediately, and Escape cancels a pending edit. Changes share the editor's undo history, and editing tempo in code updates the BPM display. Dynamic or ambiguous tempo expressions must be edited in code.

## Repository map

- src/routes: route metadata and entry points.
- src/workbench: the current session shell and branding.
- src/features: tempo controls plus review, Takes, repository, collaboration and assistant presentation modules.
- src/components/jam: the existing editor, live lenses and initial song; these stay protected during cleanup.
- src/engine: source analysis, checked patches and Strudel playback.
- src/components/ui: shared UI primitives used by the application.
- src/test: behavioral regression tests.
- public/brand: production logo, wordmark and icon assets.

Browser workspaces will be initialized and managed inside the application. Native folder access, disk reads/writes, watching and Git belong exclusively to desktop. No filesystem or cloud service is connected by the cleanup.

## Project documents

- [PRODUCT.md](PRODUCT.md): current product direction and capability status.
- [DESIGN.md](DESIGN.md): visual rules, current editor and target workbench.
- [PRODUCT_PLAN.md](PRODUCT_PLAN.md): current decisions and preserved historical rationale.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): ordered tasks and verification status.
- [AGENTS.md](AGENTS.md): development boundaries.

Built on [Strudel](https://strudel.cc/), with source at [uzu/strudel](https://codeberg.org/uzu/strudel). JamScript's licence is [AGPL-3.0-or-later](LICENSE). Available runtime dependency texts and attribution are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt); the wordmark font notice is shipped with the brand assets. The application links to the public copy of the notices. Regenerate both source and public copies after a lockfile change with `bun run licenses`, which fetches and checks the pinned Strudel licence before writing. Sample packs retain their own licences. Deployment must provide the corresponding application source.

This repository remains connected to Lovable. Preserve published history and keep the connected branch working.
