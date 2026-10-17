# JamScript workbench implementation

Approved 17 October 2026. This plan supersedes the preview-only shell sections of `IMPLEMENTATION_PLAN.md`; that file retains the broader product roadmap.

## Milestone 1 — working browser IDE (implemented)

- Detach local Lovable build and reporting code, use the official TanStack Start Cloudflare Workers Vite integration, and keep existing Git history. Disconnect the Lovable project repository link in its Git settings before the first push of this work.
- Open a workspace chooser. Create app-managed browser workspaces and documents in IndexedDB; provide an explicit Night bus example, document CRUD, tabs, recent workspaces, autosave, and visible persistence errors. Native filesystem and Git stay desktop-only.
- Preserve each document's CodeMirror source, selection, scroll and undo state across tab changes. Playback and BPM always read the active editor; source controls use the checked lens patcher.
- Replace preview Repo, Takes, presence, Share, and Rework UI with Files, document tabs, Inspector, Output/Spectrum and actual transport state. Use the approved compact typography and 900px responsive breakpoint.
- Install only audiocn Knob, Parameter Slider, Level Meter, Spectrum and their required hook/dependencies. Feed Inspector changes into source patches and meters from actual Strudel output, without demo signals.

## Milestone 2 — service-backed workspaces (pending credentials and service design)

- Add Supabase Auth and user-scoped workspace/document metadata with RLS; expose sync and invitations only when operational.
- Add Liveblocks private per-document rooms with server-minted identity tokens and document permissions; then show presence and collaboration.
- Add server-side Gemini proposal endpoints and explicit review/apply flow; then show AI assistance.
- Keep workspace identity, documents, membership, revisions and sync in JamScript's own domain model. Git may become an optional desktop integration for users who want repository workflows; it is never required to create, save or share a workspace.

## Configuration and acceptance

Milestone 1 requires no environment variables. Later services use browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, Worker-only `LIVEBLOCKS_SECRET_KEY` and `GEMINI_API_KEY`, and `APP_ORIGIN`; use `SUPABASE_SECRET_KEY` only for unavoidable privileged operations. Liveblocks also issues a public/publishable key (`VITE_LIVEBLOCKS_PUBLIC_KEY`), but this is optional and reserved for intentionally public demo rooms. Private workspaces use server-minted ID tokens from the secret key. Configure Supabase redirect URLs in its dashboard. Keep secrets out of client bundles and Git.

Verify IndexedDB creation/reload/CRUD/save errors, tab-specific undo and active playback, BPM and Inspector source patches, actual-output meter activity and silence on Stop, responsive keyboard access, no visible fixture actions, tests/lint/typecheck/build and Cloudflare preview.
