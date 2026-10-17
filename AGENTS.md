# JamScript development boundaries

- Read `PRODUCT.md` for capability status, `DESIGN.md` for visual rules, `UI_IMPLEMENTATION_PLAN.md` for the current browser workbench, and `IMPLEMENTATION_PLAN.md` for the longer roadmap. `PRODUCT_PLAN.md` preserves historical product rationale.
- CodeMirror's document is the live music source. Play evaluates the active editor; source-derived controls write through the checked patcher and its undo history. Preserve per-document editor state across tab switches.
- Keep the editor's parsing and lens engine intact unless a task explicitly calls for changing them. Derive editable ranges from Lezer syntax in `src/engine/music-document.ts`; reject ambiguous or unsupported targets.
- Browser workspaces use app-managed IndexedDB documents. JamScript owns workspace identity and management independently of Git. Native folder access, disk reads/writes, watchers and optional Git integration belong only to desktop. Do not add a browser File System Access API fallback.
- Keep the compact editor sizes in `DESIGN.md`: 14px code, 24px rhythm steps, 28px inline knobs and a 48px desktop toolbar. Preserve the 900px transport breakpoint, local scrolling and keyboard access.
- Show Repo, Takes, Rework, presence, Share and AI only after their real services and permission checks work. Legacy fixtures are not product state.
- Cloudflare Worker secrets never enter browser bundles. `VITE_` values are public. Private Liveblocks rooms use server-minted tokens, not a publishable key alone.
- Do not rewrite published Git history. Disconnect the Lovable project's GitHub link in Lovable settings before the first push of the detached workbench.
- When `/graphify` is invoked, read and follow the installed graphify skill before running its workflow.
