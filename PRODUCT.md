# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Lovable (TanStack Start in SPA mode, React, Tailwind v4, shadcn/ui) for the shells; the engine in `src/engine/` is written by hand (CodeMirror 6, Strudel, Yjs), and so are Git in `src/git/` (isomorphic-git) and one Cloudflare Pages Function that proxies Git requests to GitHub. Chosen in the project plan, not by this pass.

## Users

Two audiences, one product.

- Players: people who have heard of Strudel live coding or want to try it, and who sit with headphones on, usually in a dim room, often with a friend. They know what a knob and a drum grid are; many have never written code.
- Coders: people who already live-code with Strudel and want controls without leaving their code.
  Judges at Hacktoberfest Georgia 2026 see the landing page and the editor first, on a projector or a laptop, in a bright hall, for a few minutes.

## Product Purpose

A browser editor where Strudel code stays the source of truth and knobs and step grids (lenses) are live, editable views of it. Success: a visitor turns a knob and sees exactly the characters of code that changed, shares a link and sees a friend's change arrive, and never loses their code to a bad edit.

## Positioning

Projections with a safety rule: "if we cannot prove an edit is safe, we do not modify the source." A lens is drawn but locked when the code is outside the safe subset. A neighbouring product that generates code from a visual patch, or hides code behind a GUI, cannot truthfully say this.

## Operating Context

Two surfaces: a landing page (visitor decides in seconds) and the editor (a long session of listening, tweaking and jamming). The editor plays sound; audio only starts after a click. Collaboration is two tabs in one browser for the hackathon demo (BroadcastChannel), real sync via Yjs later. Repo, an optional set of Git buttons behind a top-bar chip, keeps a song in a GitHub repo; its working copy, identity and token stay in the person's own browser.

## Capabilities and Constraints

- Lenses: rhythm (step grid) and parameter (knob), drawn directly under the line of code they come from, over a Music IR and patcher; edits are minimal text changes, one undo step each.
- Collaboration with Yjs; Takes (semantic history labelled in musical words); optional AI "Rework" that proposes a diff with Parses, Plays and Keeps-what-you-asked checks. Rework is cut if it is not working at hour 19.
- Repo: Clone, Add, Commit, Push and Pull for the one open file, on GitHub over HTTPS. Commit messages are written from what changed in the music ("bass lpf 1200 to 430"). Safe by default: no force push, no merge, never overwrites unsaved code. Cut if it is not working at hour 19.
- Built on Strudel, AGPL-3.0-or-later; the source link and attribution are required.
- 25-hour build, two people. Terms: Lens, Take, Session, Rework, Repo.
- Product name: JamScript.

## Brand Commitments

- Tagline: "Code is the source. Lenses are how you play it."
- Credit Strudel for its own note highlighting; never present it as ours.
- Visual world carried over from the approved v1 DESIGN.md (deep indigo, warm paper text, one amber action colour, two typefaces). It was not re-rolled in this pass; it was audited and repaired.

## Evidence on Hand

- A plan with a frozen scope, Demo A and Demo B scripts, and a synthetic "Night bus" session.
- No users, testimonials, benchmarks, download counts or logos exist. None may be invented. All demo content is synthetic and must read as a demo.

## Product Principles

1. The code is always the source; a lens never owns it.
2. Safe edits only: refuse visibly rather than guess. Repo follows it: no force push, no merge, no silent overwrite.
3. Show the connection: every control and its characters of code light together.
4. Plain musical words, not engineering words. Repo's buttons keep Git's names (Clone, Add, Commit, Push, Pull) and nothing deeper.
5. Prove it on the page; do not claim it.

## Accessibility & Inclusion

WCAG AA contrast minimum, 3:1 for control boundaries; every control works by keyboard (knobs are sliders, cells are toggle buttons); no meaning by colour alone; `prefers-reduced-motion` respected; the landing page must read on a projector.
