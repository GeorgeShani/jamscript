# JamScript product plan

## Current direction, 17 October 2026

The approved direction is a local-first music IDE with a VS Code style workbench, Tauri desktop applications for Windows/macOS/Linux and a collaborative browser companion. It replaces the frozen hackathon scope preserved below.

- Source remains authoritative. Keep the existing CodeMirror editor, checked patcher, inline lenses and gesture undo; extend them deliberately rather than replacing them.
- Browser: initialize an app-managed workspace and work with its documents. Native folder access, disk reads/writes, watchers and Git are desktop-only. There is no browser File System Access API fallback.
- Desktop: anonymous local projects work without GitHub or Git knowledge. JamScript manages workspaces and revisions itself; Git is an optional desktop integration. Accounts are needed for shared workspaces, not for local music.
- Managed collaboration: Clerk sign-in and session identity, Supabase workspace data with roles and revocable invitations, and Liveblocks/Yjs for shared source and presence.
- IntelliSense: an owned, offline-capable Strudel language service with worker and stdio transports.
- Assistance: a Gemini workspace agent, using a private server key, reviewed multi-file edits and explicit Git tools. No general shell.
- Strudel compatibility: support the complete eddyflux "coastline" program, including nested stacks, chord/voicing chains, sample packs and General MIDI sounds. Complex lenses edit explicit syntax without flattening structure or replacing modulation.
- UI: keep the JamScript palette, fonts and compact editor; adopt activity/sidebar navigation, tabs, panels, a status bar and an assistant pane. Use audiocn selectively when components have a real audio or patcher consumer.
- Branding: a compact code/rhythm symbol and JamScript wordmark, with production vector and desktop assets.

[PRODUCT.md](PRODUCT.md) owns current capabilities and principles. [DESIGN.md](DESIGN.md) owns visual rules. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) owns ordered tasks and execution status. Steps 1–2 cover direction, documentation, structure and branding; later feature slices remain pending.

## Historical hackathon plan

The following original text is preserved as research and product history. Its frozen scope, deadlines, priorities, browser Git architecture and single-screen restrictions are superseded. Historical claims labeled "Verified" retain their original date and are not new verification. Old tab/prompt references are historical artifacts, not active project dependencies.

<details>
<summary>Original hackathon plan, preserved in full</summary>
# JamScript: a projectional music editor on Strudel — Hacktoberfest Tbilisi 2026 plan

Oct 16, 2026 · @George Shanidze

JamScript is a live-coding music editor built on Strudel where the code is the only source of truth and every grid and knob on screen is an editable view of that code. The hackathon build proves it with two lenses (a rhythm grid and parameter knobs), real-time sessions where collaborators' controls move too, a history of every take, button-based Git to keep songs in a repo, and one AI rework that shows what it left untouched.

Labels used below: **Verified** means confirmed in current docs or source code this week; **Decision** is our choice; **Hypothesis** is believed but not yet tested.

> We are not building a Music IDE in 25 hours. We are proving that music code can have safe, editable, collaborative projections.

**Status: frozen on 16 October 2026, amended once on 17 October 2026** to add Repo, button-based Git for the one open file (see Repo). It is P1.5 and gated at H+19, so P0 and P1 are unchanged. No other new features, modes or architecture from here; the next step is implementation.

## The idea

Live coders shape music by typing. Producers shape it by hand. JamScript makes those the same act: the program is the music, and every grid and knob on screen is a live, editable view of that program.

> Code is the only source of truth. Lenses are editable projections of it. Nothing on screen keeps its own copy of the music.

| This code                             | Shows up as                           | Touching the lens writes                |
| ------------------------------------- | ------------------------------------- | --------------------------------------- |
| `drums: s("bd ~ sd ~")`               | A 4-step grid: kick on 1, snare on 3  | `s("bd ~ sd sd")` when you click step 4 |
| `bass: note("c2 ~ eb2 g1").lpf(1200)` | A filter knob on the bass, at 1.2 kHz | `.lpf(430)` when you turn it down       |

Four things the hackathon build has to prove, and nothing else:

1. **Lenses.** Plain Strudel code becomes grids and knobs without any special syntax, and editing them rewrites exactly the characters they came from.
2. **Shared projections.** In a session, when a collaborator turns a knob, your code changes _and your knob moves_. Their avatar sits on the control they are holding.
3. **Takes.** Every time the music is played, a take is saved and labelled in musical terms ("bass filter 1200 → 430"), so you can rewind an improvisation.
4. **Rework.** You ask for a change in words; the assistant edits the code through the same operations the lenses use, and shows the diff plus proof of what it kept ("kick unchanged").

**The hierarchy (Decision), used in the build order, README, video and pitch:** Music IR → Patcher → Lenses → Collaboration → Takes → Repo → Rework. The IR and patcher are the technical core. Lenses prove them visually. Collaboration and Takes show why a semantic model is useful. Repo reuses the take labels to write commit messages in musical words, and is optional. Rework consumes the same model and is optional. This is not an AI product, and Rework never appears first or on equal footing with the IR.

### What JamScript is not

- **Not a DAW.** No timeline, no audio clips, no plugins. Music stays a program.
- **Not an AI music generator.** The AI edits your code under your approval; it never writes the song for you.
- **Not a Strudel skin.** Strudel's engine plays the sound; JamScript adds projection, shared editing and history around it.
- **Not a Git client.** Repo is a handful of buttons for one open file (clone, add, commit, push, pull), not a history graph, a merge tool or a terminal. It exists so a song can live in a repo, and so its commit messages can say what changed in the music.
- **Not a VS Code clone.** IDE chrome is cut to what the demo needs: one file, a big Play button, the lenses, the takes and, if it ships, the Repo buttons.

For technical judges: _a projectional editor for music_. For everyone else: _code you can also play with your hands_.

## Why the plan changed

The previous plan was a "VS Code for music" with three modes (Learn, Studio, Live), an AI copilot, workspaces, a PWA and a desktop app. Judged honestly, it would not have made the top 10.

| Category                 | Old score | Main reason                                                                  |
| ------------------------ | --------- | ---------------------------------------------------------------------------- |
| Originality              | 4         | Strudel's REPL, Flok and Live Music Coder already cover most of its features |
| Technical ambition       | 7         | Wide, not deep                                                               |
| Technical depth          | 4         | Mostly wiring existing libraries together                                    |
| Feasibility              | 3         | 15+ features for two people in about 25 hours                                |
| Usefulness               | 6         | Useful, but no reason to switch from strudel.cc                              |
| UX                       | 6         | Generic IDE chrome                                                           |
| Visual wow               | 6         | Nice theme, no surprising interaction                                        |
| Demo quality             | 5         | Many shallow features, no single moment people remember                      |
| Pitch clarity            | 4         | IDE + three modes + AI + collaboration is not one idea                       |
| Defensibility            | 3         | Every feature has a stronger existing tool                                   |
| Engineering credibility  | 5         | "Knobs rewrite numbers" had no architecture; "checked AI" was undefined      |
| Open-source potential    | 6         | Nothing reusable to extract                                                  |
| Post-hackathon potential | 6         | No clear first user                                                          |
| Hacktoberfest fit        | 6         | Open source and Lovable, nothing more                                        |
| Memorability             | 5         | "Another live-coding IDE"                                                    |
| Top-10 likelihood        | 5         | Depends on execution luck                                                    |
| Winning likelihood       | 2.5       | No unique idea to win on                                                     |

The five weaknesses that mattered most:

1. **No single idea.** Judges remember one interaction, not a feature list.
2. **Not defensible.** Strudel already has highlighting, autocomplete, inline visuals and `slider()` widgets bound to code; Flok already does collaborative Strudel; Live Music Coder already derives a visual graph from code.
3. **Infeasible.** Three modes plus an IDE plus AI plus collaboration does not fit the time.
4. **The hard part was invisible.** Nothing a judge could see proved engineering depth.
5. **Wrong time budget.** It assumed 36 hours; submissions close Sunday at 12:00, 25 hours after kickoff.

**Kept from the old plan:** Strudel as the engine, code as the source of truth (now the whole thesis), Yjs collaboration, AI behind a diff, the DESIGN.md visual system, Lovable for the shell, AGPL-3.0, separate app and marketing sites.

**Moved to the roadmap:** Learn/Studio/Live modes, Hydra visuals, MIDI, OSC, mixer, file explorer, PWA, desktop app.

## Hackathon facts

The event is this weekend, and the agenda with exact times is published; judging criteria, theme and submission format are not. Everything below is from [hacktoberfest.ge](https://hacktoberfest.ge/), checked 16 October 2026.

| Fact                                                                                                                                               | Status                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17–18 October 2026, Free University of Tbilisi                                                                                                     | Verified                                                                                                                                                                                 |
| Saturday: check-in 10:00, kickoff 11:00; talks from 13:00 to about 19:30 run alongside building                                                    | Verified on the [agenda](https://hacktoberfest.ge/agenda)                                                                                                                                |
| Sunday: submission deadline 12:00, then judges review; Top 10 announced 16:00; Top 10 pitches 16:30; judges' discussion 17:40; awards 18:10        | Verified on the agenda                                                                                                                                                                   |
| Build window: 25 hours from kickoff to the deadline. We submit at 11:00 Sunday (H+24) and keep the last hour as buffer                             | Window Verified; 11:00 is a Decision                                                                                                                                                     |
| Only the Top 10 pitch live. Every other team is judged on its submission alone, so the video, README and live link are what get us into the Top 10 | Inferred from the agenda; confirm what a submission must contain on Discord                                                                                                              |
| Pitch slots: 10 teams between 16:30 and 17:40, about 7 minutes each including changeover                                                           | Hypothesis from the agenda                                                                                                                                                               |
| Teams of up to 5; Discord account required (the official site says "Discord is required", rechecked 16 October)                                    | Verified                                                                                                                                                                                 |
| "Use any tech stack, tools, or workflows you like."                                                                                                | Verified                                                                                                                                                                                 |
| Lovable account recommended; required for the free builder credits and to qualify for Lovable prize tracks and bounties                            | Verified; the tracks themselves are not described                                                                                                                                        |
| Teams that submit a demo get a verified certificate                                                                                                | Verified                                                                                                                                                                                 |
| Judging criteria, theme, prize amounts, submission format                                                                                          | Not published: ask on Discord tonight                                                                                                                                                    |
| Code written before the event                                                                                                                      | Rules are silent. **Decision:** prepare the plan, design, demo song, test patterns and prompts tonight, but write no product code before kickoff unless organizers confirm it is allowed |

### Theme adaptation strategy

If a theme is announced at kickoff, the product stays the same and one thin layer changes: the problem statement, one small feature (at most 3 hours, built as a new lens or a new consumer of the Music IR), the demo song, and the pitch's first sentence. If a theme does not fit naturally, say so in one honest sentence and compete on the general track instead of bolting a feature on.

| If the theme is about…       | Problem statement                                 | One feature (≤ 3 h)                                                                                         | Demo change                                                  | Pitch's first line                                          |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Learning, education          | Music code is hard to read                        | "Explain" on any lens: a plain sentence generated from the IR, no AI ("kick on 1 and 3")                    | Hover a grid, read the sentence                              | "See the beat and the code as one thing."                   |
| Collaboration, community     | Making music together online means screen-sharing | Take links: a URL that opens any take for anyone                                                            | Laptop B joins from a QR code                                | "One program, many hands."                                  |
| Accessibility                | Music tools assume a mouse and sight              | Keyboard-only lens control plus screen-reader announcements generated from the IR ("snare added on step 3") | Edit the grid with the keyboard while the announcement plays | "Music code you can play without a mouse."                  |
| AI                           | AI music tools replace the musician               | Rework becomes P0; add "explain this change" on any take diff                                               | Open with the rework                                         | "AI that edits your music and proves what it didn't touch." |
| Open source, developer tools | Music tools are closed boxes                      | Show on stage how a lens plugs into the registry (code walkthrough only; no new lens built)                 | Show the new lens appear                                     | "Anyone can teach the editor a new instrument."             |
| Culture, place, heritage     | Traditional music forms rarely meet code          | A template set in that style, shown through the existing lenses                                             | The demo song uses the template                              | Name the tradition, then demo                               |

This works because lenses and the IR are the extension points: a theme feature is one more lens or one more reader of the IR, never a rebuild.

## Field research

Every single piece of this idea already exists somewhere. What we did not find in any tool is the combination: controls inferred from plain Strudel code that write back to it, shared live between collaborators, with a semantic history and an AI that checks what it preserved. That combination, not any single feature, is the differentiator.

### Competitors

| Tool                                                                                                                                               | What it is                                                                                                                                                                              | Strongest at                                                                                                                                                                                                                                                                                                                                                    | Overlap with us                                                        | Do not claim                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| [Strudel REPL](https://strudel.cc/)                                                                                                                | TidalCycles patterns in JavaScript, in the browser (AGPL-3.0)                                                                                                                           | The engine, mini-notation, [note highlighting and inline visuals](https://strudel.cc/learn/visual-feedback/) (`_pianoroll`, `_scope`, `_spiral`), autocomplete; its [transpiler](https://cdn.jsdelivr.net/npm/@strudel/transpiler@1.2.6/transpiler.mjs) turns explicit `slider(800, 100, 2000)` calls into inline slider widgets bound to their source position | Engine, editor, code-bound sliders                                     | "First knob that edits code"                    |
| [Flok](https://codeberg.org/munshkr/flok)                                                                                                          | Collaborative live-coding editor (CodeMirror 6 + Yjs), Strudel among many targets, GPL-3.0+, v1.3.1, active Sept 2026                                                                   | Multi-language performance jams                                                                                                                                                                                                                                                                                                                                 | Real-time collaboration                                                | "First collaborative Strudel editor"            |
| [Live Music Coder](https://arnoldwender.com/en/blog/live-music-coder-case-study/)                                                                  | Browser and macOS IDE with 4 engines incl. Strudel, CodeMirror 6, 7 visualizers, MIDI learn, AGPL (MIT parts); v1.3.1, Aug 2026                                                         | A node graph derived from code that [writes back for Tone.js and Web Audio; view-only for Strudel](https://github.com/arnoldwender/wm-prototyp-live-music-coder). Its README says the code editor is the single source of truth. No real-time co-editing or AI assistant described                                                                              | Code as the source of truth; editable graph (not for Strudel); desktop | "First bidirectional code and GUI music editor" |
| [Strudel Flow](https://github.com/xyflow/strudel-flow)                                                                                             | Node-based UI (React Flow + shadcn) that generates Strudel; Pad and Beat Machine nodes; AGPL                                                                                            | Visual-first patching                                                                                                                                                                                                                                                                                                                                           | Step sequencer that produces code                                      | "First visual step sequencer for Strudel"       |
| [Sonic Pi v5](https://zeli.app/en/story/49208296)                                                                                                  | Desktop live coding in a Ruby DSL; v5 (Aug 2026) adds performance visuals, MIDI clock sync, Ableton Link Audio                                                                          | Teaching and performance                                                                                                                                                                                                                                                                                                                                        | Live coding for learners                                               | Easier to learn than Sonic Pi                   |
| [Estuary](https://www.github.com/dktr0/estuary)                                                                                                    | Browser platform for networked live-coding ensembles, GPL-3.0                                                                                                                           | Ensemble performance across languages                                                                                                                                                                                                                                                                                                                           | Browser collaboration                                                  | "First browser jam platform"                    |
| [EarSketch](https://en.wikipedia.org/wiki/EarSketch)                                                                                               | Georgia Tech's Python/JavaScript music course; code fills DAW-style tracks                                                                                                              | Curriculum at scale                                                                                                                                                                                                                                                                                                                                             | Code shown as visual tracks                                            | "First tool linking code to a visual view"      |
| Gibber                                                                                                                                             | Browser live coding; [research on visual annotations in source code](https://chrischafe.stanford.edu/events/making-source-code-dance-visualizing-algorithms-in-live-coding-performance) | Code that animates with the music                                                                                                                                                                                                                                                                                                                               | Linking code and visuals                                               | "First to animate code with musical state"      |
| [Topos](https://synth.playtronica.com/topos)                                                                                                       | Browser algorithmic sequencer inspired by Monome Teletype                                                                                                                               | Scripting plus MIDI                                                                                                                                                                                                                                                                                                                                             | Browser live coding                                                    | —                                               |
| TidalCycles                                                                                                                                        | The Haskell original of Strudel's pattern language                                                                                                                                      | Depth, community                                                                                                                                                                                                                                                                                                                                                | Pattern language                                                       | —                                               |
| Strudel MCP servers and LLM docs ([example](https://lobehub.com/mcp/takeachangs-strudel-mcp), [docs](https://github.com/calvinw/strudel-llm-docs)) | AI assistants that generate, transform, validate and query Strudel patterns                                                                                                             | Generation                                                                                                                                                                                                                                                                                                                                                      | AI for Strudel                                                         | "AI that writes Strudel"                        |

Three more tools overlap, all Verified this week:

- [**StrudelLM**](https://github.com/tambo-labs/strudellm) (Tambo, AGPL-3.0): describe music in chat, the AI writes Strudel and plays it, retrying automatically until the code runs. Archived on 6 October 2026. It generates code; it does not show diffs or check what a change preserved. Do not claim "chat that writes Strudel".
- [**Apfelstrudel**](https://github.com/rcarmo/apfelstrudel) (AGPL-3.0): a Strudel editor with an AI chat agent that can set patterns, play and change tempo through tools. Do not claim "an AI agent that edits Strudel".
- [**seqbaby**](https://github.com/mjoslyn/seqbaby/pull/138) (merged 28 September 2026): a browser step sequencer whose Strudel code drawer syncs both ways with the song. Its song is the source and the code is a view that merges in when run; ours is the reverse. Do not claim "first grid that syncs with Strudel code".

### Comparison matrix

"No" means not found in the docs and source we checked, not proven absent.

| Capability                        | Strudel REPL             | Flok    | Live Music Coder                         | Strudel Flow              | Sonic Pi | JamScript (hackathon target)     |
| --------------------------------- | ------------------------ | ------- | ---------------------------------------- | ------------------------- | -------- | -------------------------------- |
| Code is the source of truth       | Yes                      | Yes     | Yes                                      | No, nodes first           | Yes      | Yes                              |
| Music-aware editor                | Yes                      | Partial | Yes                                      | —                         | Partial  | Yes, Strudel's                   |
| GUI edits write back to code      | Explicit `slider()` only | No      | Tone.js and Web Audio; Strudel view-only | Generates code from nodes | No       | Yes: grid and knobs, on a subset |
| Controls inferred from plain code | No                       | No      | Yes, a graph                             | No                        | No       | Yes                              |
| Real-time multiplayer             | No                       | Yes     | No (tab clock-sync preview)              | No                        | No       | Yes                              |
| Collaborators see controls move   | —                        | —       | —                                        | —                         | —        | Yes                              |
| Shared history of plays           | No                       | No      | No                                       | No                        | No       | Yes                              |
| AI edits code                     | No                       | No      | No                                       | No                        | No       | Yes, one flow                    |
| AI checks what it preserved       | No                       | No      | No                                       | No                        | No       | Yes (hypothesis)                 |
| Live performance maturity         | High                     | High    | Medium                                   | Low                       | High     | Low                              |
| Beginner path                     | Workshop                 | No      | Examples                                 | Visual                    | Strong   | Partial                          |
| Open source                       | AGPL                     | GPL     | AGPL + MIT                               | AGPL                      | Yes      | AGPL                             |
| Runs in the browser               | Yes                      | Yes     | Yes, plus macOS app                      | Yes                       | No       | Yes                              |

**Where we lose, and don't compete:** performance maturity (Flok, Sonic Pi, Strudel), engine breadth and visualizers (Live Music Coder), language depth (Strudel, TidalCycles), teaching curriculum (EarSketch, Sonic Pi).

### Gaps we found (hypotheses from this search)

1. No Strudel editor found where controls appear on plain code, with no special syntax, and write back to it while the code stays the source (seqbaby syncs both ways, but its song is the source).
2. None found where those controls are shared live, so a collaborator's knob turn moves yours.
3. None found with a shared, musically labelled history of evaluations.
4. AI tools found generate or transform patterns; none found that verify what the change preserved.

### What not to claim

- Never "no tool does X". Say "our differentiator is the combination of inferred lenses, shared projections, takes and checked rework".
- Not the first knobs that edit code (Strudel `slider()`), the first collaborative Strudel (Flok), the first code-to-GUI editor (Live Music Coder), the first visual Strudel sequencer (Strudel Flow), or the first AI for Strudel (MCP servers).

## Who it's for

**Primary user (Decision): the developer who jams.** Comfortable with code, thinks in sound, has tried Strudel or Sonic Pi, and keeps getting pulled out of the music to hunt for the right number or count steps in a string. Lenses let them tune by ear and hand without leaving the program; takes let them improvise without fear of losing a good groove; sessions let them jam with a friend.

Why this user: it is the audience in the room (a developer hackathon, developer judges), it is the user whose problem the demo shows in seconds, and it is the user most likely to contribute lenses back to the project.

| User                                 | What they get                                                 | Hackathon priority                                                                    |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Developer who jams                   | Tune by hand, rewind takes, jam in a session, keep songs in a repo, refactor safely | **Primary**: every demo beat is for them                                              |
| Beginner learning music through code | Sees what each part of the code does by touching it           | Secondary: falls out of the lenses for free; mentioned in the pitch, not designed for |
| Producer curious about code          | Knobs and grids they know, on top of real code                | Secondary: the pitch's second sentence                                                |
| Live-coding performer                | Speed, projection, stability on stage                         | Roadmap (performance view in v0.3)                                                    |
| Teacher                              | Visual views tied to syntax, shared classroom sessions        | Roadmap and business model                                                            |

What the primary user is promised, in their words (Hypothesis, to test by watching two people use the prototype on Saturday night):

1. "I can find and change the thing I hear without reading the whole file."
2. "I can try something wild and get back to the good version."
3. "My friend's changes show up in the controls I'm already looking at."
4. "The AI changed only what I asked, and it showed me."
5. "My song lives in a repo, and the commit message says what changed in the music."

## The product

One screen, no modes. Everything on it is either the code or a view of the code.

```text
┌ JamScript   Night bus  ⎇ main 1  ◉ NK  ◉ GS             [ ▶ Play ]   Invite ┐
├─────────────────────────────────────────────────────────────────────────────┤
│ 2  drums: s("bd ~ sd ~ bd bd sd ~");                                        │
│ ┃  ■ □ ■ □  ■ ■ ■ □                                                         │
│ 3  hats:  s("hh hh hh hh").gain(0.6);                                       │
│ ┃  ■ ■ ■ ■    gain ◯ 0.60                                                   │
│ 4  bass:  note("c2 ~ eb2 g1").s("sawtooth").lpf(1200).room(0.2);            │
│ ┃  lpf ◯ 1.2 kHz    room ◯ 0.20                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Takes  ● 19:42 drums added  ● 19:43 hats 4 → 8  ● 19:44 bass lpf 1200 → 430 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Ask for a change: "double the hats, keep the kick"                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

The chip beside the session name is Repo: the branch (`main`) and the number of changes (`1`). Each lens sits directly under the line of code it came from, joined to it by a rule in the track's colour (the `┃`).

### Lenses

A lens is an editable view of one recognised piece of code. It appears automatically directly under the code it came from; the code needs no special syntax (Decision). Two lenses ship at the hackathon:

| Lens      | Recognises                                                                                                                         | Shows                                                                                | An edit writes                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Rhythm    | The string in `s("…")` or `sound("…")` when it is a flat sequence of up to 16 steps, each a sound name or `~`, optionally `name*n` | A grid: one row per sound, one column per step; `*n` shown as a small ×n on the cell | Only the characters inside the quotes, in canonical form: `s("bd ~ sd ~")` → `s("bd ~ sd sd")` |
| Parameter | A number literal as the first argument of `lpf`, `hpf`, `gain`, `room`, `delay`, `pan` or `speed`                                  | A knob with a range and unit per parameter (lpf 50–8000 Hz, log scale)               | Only the number: `.lpf(1200)` → `.lpf(430)`                                                    |

Outside that subset (nested brackets, `< >` alternation, patterns passed as variables, chained mini-notation in parameters) the lens shows the code read-only with "Edit in code" instead of guessing (Decision). A small, honest subset that round-trips perfectly proves the idea better than a large one that sometimes mangles code.

**Safe refusal is a feature we show, not a limitation we hide (Decision).** The demo song contains one deliberately complex line, for example `perc: s("<[bd bd] ~ [sd <cp rim>]*2>")`. Its lens is drawn but locked, with the tooltip "Edit this one in code"; editing the code by hand works, and the lens never touches it. The rule, said in the demo and the README: **if we cannot prove an edit is safe, we do not modify the source.** That is what shows the patcher is engineering rather than string replacement.

**The "same object" rule** (Decision): putting the cursor on `.lpf(1200)` lights the bass knob; hovering the knob outlines `1200` in the code; hovering a grid cell outlines its step in the string. Dragging the knob changes the number in place while the music changes. This is the moment the audience understands the product.

P1 polish: while a lens is hovered or dragged, draw a thin `link`-coloured connector from the code characters to the control, so someone watching the video sees the link without narration. Hypothesis: it stays readable when the editor scrolls; if not, keep the paired highlight alone.

Every lens edit is one CodeMirror transaction, so Ctrl+Z undoes a whole drag as one step, and the edit syncs to the session like typing does.

### Sessions

A session is a shared document, like a Google Doc for one piece of music. Anyone with the link joins.

- **Shared projections.** Lenses are recomputed from the code after every change, local or remote. A collaborator's knob turn arrives as a text change, so your knob moves without any extra protocol (Decision). This is the demo's strongest moment.
- **Presence on controls.** Each person has a colour (DESIGN.md track colours). Their cursor shows in the code, and while they hold a control their avatar ring sits on that knob or grid row on everyone's screen.
- **Playing together.** Each laptop runs its own Strudel engine. Pressing Play broadcasts "play take N"; every laptop evaluates the same code. For the demo, only one laptop sends audio to the speakers (host audio) so the room doesn't hear two slightly offset copies (Decision).

### Takes

Every successful play (pressing Play, re-evaluating, or releasing a knob or grid edit) saves a take: who, when, the code, and a label written in musical terms by comparing the Music IR of this take with the previous one.

| Change between takes          | Label                   |
| ----------------------------- | ----------------------- |
| Parameter value               | `bass lpf 1200 → 430`   |
| Rhythm steps                  | `hats 4 → 8 hits`       |
| New labelled track            | `bass added`            |
| Anything the IR doesn't model | `code edited (3 lines)` |

- **Audition** a take: play it without touching the document; a banner says "Auditioning 19:43" with Restore and Back to live.
- **Compare**: a unified diff of the take against the current code.
- **Restore**: one undoable transaction that replaces the code, plays it, and saves a new take "restored 19:43".
- Takes live in the session document, so everyone shares one history (Decision). They are snapshots of a few hundred characters each, not Git commits; the last 200 are kept. Repo (below) is how a version is kept for good, and it reuses the take labeller to name a commit.

### Repo

Repo is Git for the one open file, as buttons: Clone, Add, Commit, Push, Pull. It works like GitHub Desktop, not like a terminal. A song can live in a repo, and the commit message is written from what changed in the music. P1.5, decided at H+19 (see Hackathon scope); the static mock ships with the Lovable shell either way, so the wiring is the only gated work.

**Where it lives (Decision).** A chip in the top bar, beside the session name, shows the branch and the number of changes. It opens a popover (a floating layer, not a dialog and not a side panel), so the screen keeps its one-screen layout with no file tree and no new mode. Top to bottom the popover holds: the repo and branch; the song files; Changes and Ready to commit; the commit message with Commit; Push and Pull; the last five commits.

| Step        | Button                             | What happens                                                                                                                                                                                                                  | Git underneath                              |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Clone       | Clone, after pasting a GitHub URL  | A shallow, single-branch clone into browser storage. The popover then lists the repo's song files as a flat list of paths                                                                                                      | `clone` with `depth: 1`, `singleBranch: true` |
| Open        | A file in the list                 | Starts a new session from that file's text, named after the file. The repo and file are remembered for that session on this device                                                                                             | Read the file at the branch tip             |
| See changes | A row under Changes                | The open file appears when its code differs from the last commit, with a musical summary ("bass lpf 1200 to 430, hats 4 to 8 hits") and `+2 -2`. Clicking the row opens the unified diff inline over the editor, the same panel Rework uses | Diff against the last commit                |
| Add         | Add (per file), Add all            | Moves the file to Ready to commit; Remove moves it back                                                                                                                                                                        | `add`                                       |
| Commit      | Commit                             | Writes the editor's code to the file in the working copy and commits it with the message box's text. If nothing was added, it commits all changes                                                                              | `add`, `commit`                             |
| Push        | Push to main                       | Sends the branch's new commits to GitHub. The button names the branch it will push to. Never forces                                                                                                                            | `push`                                      |
| Pull        | Pull                               | Fetches. If GitHub is simply ahead, moves the branch forward and offers Load into editor                                                                                                                                       | `fetch`, then a fast-forward                |

Rules (all Decisions):

1. **Code stays the source.** The working copy's file is written only when you commit. Repo never rewrites the editor except through Load into editor, which behaves like Restore: one undoable transaction that saves a take "pulled from main". It is disabled, with the reason shown, while the editor has changes that are not committed.
2. **Safe by default: the patcher's rule applied to Git.** No force push, no merge commits, no rewriting history, no deleting branches. If both sides have new commits, Push and Pull refuse and say so in plain words: "GitHub has new commits and so do you. JamScript can't merge yet; open the repo on GitHub to combine them."
3. **Per person, not per session.** The working copy, name, email and token live in your browser and never enter the session document. In a shared session anyone can commit their own copy; Load into editor is an ordinary edit that everyone sees and can undo.
4. **Small on purpose.** GitHub over HTTPS only; one repo at a time (cloning another asks first and replaces it); the song is a text file ending `.js`, `.mjs` or `.strudel`, under 64 KB (the extension list is a Hypothesis, check it against real Strudel repos at H0). No branch switching, tags, submodules or LFS.
5. **Sign-in is a pasted token.** A fine-grained personal access token with Contents read and write on one repo, asked for inline only when a push or a private clone needs it; public repos clone without one. It is kept in `sessionStorage` (gone when the tab closes) and never goes in the session document or a URL. Whether a token limited to one repo is enough for `push` is checked in the H0–2 smoke test.
6. **Identity.** Name and email are asked once, on the first commit, with a hint to use the GitHub no-reply address.
7. **The message is pre-written.** The subject comes from the take labeller, comparing the Music IR of the committed file with the current code, joined with commas and cut at 72 characters. When the IR can't say, it is "Update night-bus.js (3 lines)". It is always editable.
8. **Errors name the problem and the fix.** Token refused: "GitHub refused this token. Make a new one with Contents: Read and write for this repo and paste it again." Rejected push: "GitHub has newer commits. Pull first." Offline: "Can't reach GitHub from here. Commit still works; push when you're back online." No song files: "No song files here. JamScript opens files ending in .js, .mjs or .strudel."

**What the proxy sees.** Browsers can't call GitHub's Git endpoints directly (Verified in isomorphic-git's docs: GitHub sends no CORS headers for them), so every Git request goes through our own small proxy (see Deployment), which therefore sees the token in transit. The README and the Q&A say so plainly; it is also why we run our own proxy rather than a public one.

**How it fits the build.** Repo reads the Music IR only to label changes. It adds nothing to the lenses, the patcher or the Yjs document, so its risk stays away from P0.

### Rework

Rework is the AI, scoped to one job: change existing music on request, under approval. It does not generate songs.

1. You type a request: "double the hats, keep the kick".
2. The model receives the code, a compact list of the recognised tracks and nodes from the Music IR, and the relevant Strudel function docs.
3. It must answer with structured intent and edits:

```json
{
  "target": "hats",
  "operation": "increase_density",
  "preserve": ["drums:bd", "tempo"],
  "edits": [
    {
      "op": "setSteps",
      "node": "hats/rhythm",
      "steps": "hh hh hh hh hh hh hh hh"
    }
  ],
  "explanation": "Hats now play eighth notes instead of quarter notes."
}
```

4. The edits go through the same patcher the lenses use, on a scratch copy. A request the edit vocabulary can't express may return a code patch instead, which gets the same checks.
5. Checks, in order: the code parses (Strudel's transpiler and mini-notation parser); it evaluates without playing; and every `preserve` item produces identical events over the first 4 cycles before and after (for example, the same kick hits at the same times). Tempo is compared from the code.
6. You see the diff, the explanation and the check results ("kick: 8 of 8 events unchanged"). Nothing changes until you press Accept; a failed check disables Accept and says which check failed.

Scope of the preservation claim (Decision): it holds only for the supported subset. Strudel patterns can be asked for their events without playing (`queryArc`), so for code inside the subset we compare before and after over 4 cycles and show the result, for example "Kick: 8 of 8 hits unchanged". Evaluating arbitrary Strudel can have side effects (`setcps()` changing the live tempo, MIDI or OSC output), so the dry run stubs those calls; for anything outside the subset the check is refused and the diff says "Not checked" instead of showing a green tick. Whether the stubbed dry run is reliable is a Hypothesis until the H+19 Rework decision.

## Architecture and Music IR

&#91;embedded content: architecture · code at the centre, one patcher for every edit\]

The code is the only stored state. The IR, the lenses and the takes labels are recomputed from it on every change (a full reparse for the hackathon, where the song is under 50 lines; incremental parsing later); lenses, collaborators and Rework all change the code through the same patcher. Decision.

### Music IR

Minimal on purpose: only what the two lenses and the takes labels need. Built from CodeMirror's error-tolerant Lezer tree (calls, labels, number literals) plus Strudel's own mini-notation parser for strings, whose nodes carry character offsets (Verified with `"bd ~ sd ~ hh*4"` and `"bd*2 [~ bd] sd ~"`).

```ts
type Range = { from: number; to: number }; // offsets in the document
type NodeId = string; // stable: "bass/param/lpf", "hats/rhythm"

interface RhythmPattern {
  kind: "rhythm";
  id: NodeId;
  track: string;
  call: "s" | "sound";
  stringRange: Range;
  steps: Step[]; // at most 16
  editable: boolean; // false outside the safe subset
}
type Step = { sound: string | null; subdiv?: number }; // null = "~", subdiv from name*n

interface Param {
  kind: "param";
  id: NodeId;
  track: string;
  name: "lpf" | "hpf" | "gain" | "room" | "delay" | "pan" | "speed";
  valueRange: Range;
  value: number;
  spec: { min: number; max: number; scale: "lin" | "log"; unit?: string };
}

type LensEdit =
  | { op: "toggleStep"; target: NodeId; step: number; sound: string | null }
  | { op: "setParam"; target: NodeId; value: number }
  | { op: "setSteps"; target: NodeId; steps: Step[] };
```

Node ids come from the track label, the kind and the parameter name, so a lens keeps its identity while someone types elsewhere, and a collaborator's presence can point at `bass/param/lpf` rather than at a character offset.

### Lens registry

```ts
interface Lens<N> {
  kind: string;
  match(node: unknown): node is N;
  render(props: {
    node: N;
    dispatch(e: LensEdit): void;
    presence: Presence[];
  }): JSX.Element;
  toPatch(node: N, edit: LensEdit, source: string): SourcePatch | null; // null = refuse
}
```

A third lens is a new file that registers itself; nothing else changes. That is the post-hackathon lens SDK.

### Patch rules

1. A patch touches only the node's own range: the number literal, or the inside of the string.
2. It keeps the original formatting: number precision from the step size, spacing and `~` style inside strings.
3. One gesture is one CodeMirror transaction and one undo step; a drag updates the same transaction group until release.
4. Before dispatching, the patcher re-parses the result; if the IR of any other node changed, it refuses.
5. Remote edits arrive as ordinary text changes through Yjs; every client re-derives its own IR and lenses.

### Stack

| Part   | Choice                                                     | Status             |
| ------ | ---------------------------------------------------------- | ------------------ |
| Editor | CodeMirror 6 with `@strudel/codemirror` extensions         | Verified available |
| Engine | `@strudel/web` / core, mini, transpiler, webaudio          | Verified, AGPL     |
| Sync   | Yjs, y-codemirror.next, Liveblocks; y-webrtc fallback      | Verified available |
| Diffs  | `@codemirror/merge` unified view for Rework                | Verified available |
| UI     | React, shadcn/ui, Tailwind 4, DESIGN.md tokens             | Decision           |
| AI     | One edge function returning intent JSON                    | Decision           |
| Tests  | Vitest round-trip suite: 30 cases by G3, 50+ by submission | Decision           |
| Git    | `isomorphic-git` with `@isomorphic-git/lightning-fs` (browser storage), shallow single-branch clones | Verified usable in browsers with a CORS proxy; licences are a Hypothesis, check at H0 |
| Git proxy | One Cloudflare Pages Function, GitHub only | Decision           |

## UI direction

An instrument that happens to be an editor: a dark stage, warm text, one amber "record light" for action, and colour used only to tie things together. The full rules, tokens and fonts are in the DESIGN.md tab; these are the principles behind them.

1. **The same object, everywhere.** A code range and its control share one highlight, in the track's colour. Focus on one and the other lights. This replaces decoration as the visual identity.
2. **Code is the largest thing on screen.** The editor gets the full width, with code at 14px. Each lens sits directly under the line of code it came from, joined to it by a rule in the track's colour, never in a separate panel or window.
3. **Changes are visible.** When a lens edits code, the changed characters flash amber for 300 ms, so the audience sees the code rewrite itself. Remote changes flash in the collaborator's colour.
4. **Play state is unmistakable.** One large Play/Stop button; while playing it is filled amber and a dot pulses once per cycle.
5. **Strudel's own note highlighting stays on**, coloured per track. It is Strudel's feature, not ours, and we say so if asked. Syntax highlighting is always on too, with the syntax colours in DESIGN.md.
6. **Nothing that VS Code already does.** No file tree, no tabs, no settings screen, no command palette at the hackathon. One file per session. The one exception is the Repo popover (Decision): a flat list of song files inside a popover, never a tree or a panel.
7. **Quiet motion.** Only the note highlight, the change flash and the play pulse move. No entrance animations, no glows, no gradients.

Accessibility floor: every lens control works with the keyboard (arrows change a knob, space toggles a grid cell), every control has a label read by screen readers, and colour is never the only signal (cells use filled vs outlined shapes too).

## Hackathon scope

The test for every item: could VS Code do this without understanding music? If yes, it is not in P0 or P1. Repo fails this test on its own, so it is P1.5 and gated, and its change summaries and commit messages come from the Music IR.

| Priority                                     | Item                                                                                                                                       | Why                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **P0** demo can't happen without it          | Strudel plays from our CodeMirror editor, with Strudel's highlighting, our syntax colours and autocomplete switched on                                         | The instrument                                                       |
| P0                                           | Music IR from the editor's syntax tree plus Strudel's mini-notation parser; a full reparse on every change is fine for a 50-line song      | The technical core                                                   |
| P0                                           | Patcher: LensEdit → minimal text change → one transaction, refusing what it can't prove safe                                               | The technical core                                                   |
| P0                                           | Parameter lens with the "same object" highlight                                                                                            | Proves the core visually                                             |
| P0                                           | Rhythm lens on the safe subset                                                                                                             | Proves the core visually                                             |
| P0                                           | Session on two laptops: shared code, lenses that follow, presence on controls; two tabs of one browser also sync                           | Why the semantic model matters                                       |
| P0                                           | One rehearsed demo song in labelled tracks, including one deliberately complex line that stays read-only; samples served from our own host | Safe refusal on screen; no dependency on venue Wi-Fi                 |
| P0                                           | Submission experience: self-guided demo state on the live link, README, public repo, 2-minute video (see Submission experience)            | Judges are assumed to review alone; this is the product they see     |
| **P1**                                       | Takes: save, musical labels, audition, restore                                                                                             | Second proof that the IR is useful; ranked above Rework              |
| P1                                           | Correctness: round-trip suite to 50+ cases, precise source-range highlighting, one-gesture undo, collaboration and Takes correctness       | Where spare hours go. Two excellent lenses beat three imperfect ones |
| P1                                           | Change flash, remote colour flash, connector line                                                                                          | Makes the link visible in a video and from the back row              |
| P1                                           | Landing page in Lovable                                                                                                                    | Lovable track eligibility                                            |
| **P1.5** only if REPO = GO at H+19 | Repo: clone, open a file, changes, add, commit, push and pull (fast-forward only) on GitHub over HTTPS. The static Repo mock ships with the Lovable shell | A song can live in a repo; commit messages use the IR |
| **P1.5** only if REWORK = GO at H+19         | Rework: one flow with structured edits, checks and Accept/Discard                                                                          | AI is seasoning; the IR is the project                               |
| **P2** only after the submission is finished | A third lens; Hydra visuals; PWA install                                                                                                   | Breadth, not proof                                                   |
| **After**                                    | Learn, Studio and Live modes; MIDI; OSC; mixer; sample browser; multi-file projects; Git beyond the basics (branches, GitHub sign-in, GitLab and Codeberg, merge help, several repos); lens SDK; desktop app (Tauri); classroom features     | See Roadmap                                                          |

## Build plan

&#91;embedded content: build plan · 8 bands, 8 gates, hours from Saturday kickoff (bands not to scale)\]

Hours count from kickoff at 11:00 Saturday (H0). Submissions close at 12:00 Sunday (H+25); we submit at 11:00 (H+24). A gate is a yes/no check at a fixed hour, and missing one means switching to its fallback, not working longer. From 12:00 to 16:00, while judges review (we assume without us; confirm), we rehearse the Top 10 pitch instead of writing code. Decision.

| Gate | Hour  | Clock     | Must work                                                                                        | If not                                             |
| ---- | ----- | --------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| G0   | H+0.5 | Sat 11:30 | Roles agreed, Lovable decision made, repo public, empty app deployed                             | Decide in the next 15 minutes; no coding before G0 |
| G1   | H+2   | Sat 13:00 | Pressing play in the deployed app makes sound from editor code                                   | Hand-built Vite app (see fallbacks)                |
| G2   | H+6   | Sat 17:00 | Knob round trip: drag changes the number, typing moves the knob, linked highlight, one undo step | Re-evaluate on release only; fewer parameters      |
| G3   | H+10  | Sat 21:00 | Grid round trip on the demo song; 30-pattern suite green                                         | Plain steps only, `name*n` read-only               |
| G4   | H+13  | Sun 00:00 | Two laptops: code, lenses and presence in sync                                                   | y-webrtc in two windows                            |
| G5   | H+19  | Sun 06:00 | Takes saved on play, labelled, audition and restore; then the Rework decision below              | Time-and-track labels                              |
| G6   | H+21  | Sun 08:00 | Feature freeze. Rework ships only if its pre-tested prompts pass, and Repo only if its pre-tested flow passes                                 | Ship without Rework or Repo and name them as the next step   |
| G7   | H+24  | Sun 11:00 | Submitted: live link, repo, README, video                                                        | The 11:00–12:00 hour is the only buffer            |

**H+19 Rework decision (Sunday 06:00).** One named person says out loud, and writes in the team chat, either **REWORK = GO** or **REWORK = CUT**. GO only if all four hold: P0 is stable, collaboration works on two laptops, Takes work, and Demo B runs clean end to end. Anything else is CUT: Rework stays off the main branch, Demo B is the official demo and video, and H19–21 goes to round-trip tests and polish. No "another 30 minutes".

**H+19 Repo decision (same moment, same rule).** Someone says **REPO = GO** or **REPO = CUT**, out loud and in the team chat, on the same four conditions. Repo is decided first: it has no model call to flake, and it ranks above Rework in the hierarchy. A team of four can GO on both. A team of two can GO on one: if both look possible, Repo goes first and Rework then needs the hours Repo leaves, which usually means CUT. If the H0–2 smoke test never passed, Repo can still ship local-only (see Failure fallbacks).

Roles for a team of two: **A** owns the engine (IR, patcher, lenses, tests); **B** owns the app (Lovable shell, Strudel playback, sessions, takes, Rework edge function, Repo's `src/git/` module and Git proxy, landing page) and runs the demo.

Roles for a team of four: **IR and patcher** (tests from H0), **Lenses and UI** (knob, grid, linked highlight, DESIGN.md), **Sessions and takes** (Yjs, presence, takes rail, then Repo from H+19), **Rework, landing page and pitch** (edge function, checks, slides, backup video).

Hour by hour:

- **H0–2 (11:00–13:00) Setup:** repo, deploy, Strudel playing in the shell; the IR owner writes the first 10 test patterns from the demo song. Skip the talks. After G1 passes, B spends 20 minutes on a Git proxy smoke test: deploy the proxy function, clone one public repo from the browser console, and push one commit to a throwaway repo with a fine-grained token. If it fails, Repo is local-only from here on.
- **H2–6 (13:00–17:00) Knobs:** Parameter lens, patcher for numbers, linked highlight.
- **H6–10 (17:00–21:00) Grid:** Rhythm lens, mini-notation patching, test suite to 30 patterns.
- **H10–13 (21:00–00:00) Session:** Liveblocks room, shared lenses, presence rings, remote flash.
- **H13–17 (00:00–04:00) Sleep in shifts:** with four people, two sleep while two start Takes, then swap; with two, both sleep at least three hours.
- **H17–19 (04:00–06:00) Takes:** save on play, IR diff labels, audition, restore.
- **H19–21 (06:00–08:00) Repo and Rework, only if G1–G5 passed and each decision is GO:** Repo is the `src/git/` module, clone, open file, changes, add, commit, push and pull (about two hours, a Hypothesis); Rework is the edge function, intent JSON, checks, merge view and Accept. Otherwise polish and more test patterns.
- **H21–24 (08:00–11:00) Package:** record the video, write the README, fix only bugs on the demo path, submit at 11:00.
- **H24–25 (11:00–12:00) Buffer.** Then 12:00–16:00: rehearse the pitch ten times and prepare for the Top 10 announcement.

## Failure fallbacks

Decision: every P0 and P1 feature has a fallback chosen now, so nobody improvises at 3 a.m.

| If this fails                                                   | Detected at            | Fall back to                                                                                                                                 | What the demo loses                                        |
| --------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Strudel won't run inside the Lovable app                        | G1, H+2                | A plain Vite + React app built by hand with the same DESIGN.md tokens; Lovable builds only the landing page                                  | Nothing on stage; Lovable prize eligibility for the editor |
| Lezer tree can't reliably find calls inside `stack()` or labels | G2, H+6                | Support labelled tracks only (`drums: s("...")`), one call chain per label; anything else read-only                                          | Nothing, the demo song is written in that shape            |
| Krill offsets don't map back cleanly for `name*n`               | G3, H+10               | Rhythm lens supports plain steps and `~` only; `hh*4` shows as read-only                                                                     | One beat of the grid demo                                  |
| Lenses as widgets inside CodeMirror misbehave (layout jumps, focus, drags) | G2, H+6 | A fixed right-hand lens panel, as in the first Lovable shell, with each group placed beside its track by hand | The cable at rest; the knobs and grids still work |
| Patcher bugs: edits damage nearby text                          | Test suite, any time   | Lens writes disabled for that node; code stays editable; bug logged                                                                          | The control for that node only                             |
| Liveblocks or venue Wi-Fi fails                                 | G4, H+13, and on stage | y-webrtc between two windows of one browser (no network), shown on one laptop split screen                                                   | The two-laptop moment becomes two windows                  |
| Re-evaluating while dragging glitches the audio                 | G2                     | Re-evaluate on release only; the code still updates live while dragging                                                                      | Hearing the sweep during the drag                          |
| Takes labels are wrong or noisy                                 | G5, H+19               | Label takes with time and track name only ("04:12 · drums")                                                                                  | The musical diff labels                                    |
| Rework returns invalid edits or the checks are flaky            | G6, H+21               | Ship without Rework; or, if asked to show it, two pre-recorded intents replayed through the same real checks and diff, disclosed as a replay | The live model call                                        |
| Browser Git fails: the proxy is blocked, GitHub refuses the token, or the function can't stream a pack | The H0–2 smoke test, and G6 | Repo ships local-only: a demo repo is seeded into browser storage, and Changes, Add, Commit and the history work offline. Clone, Push and Pull say "Can't reach GitHub from here" | Publishing to GitHub from the app |
| Laptop audio or projector fails                                 | On stage               | The submission video, played from a phone or the second laptop                                                                               | Live-ness                                                  |
| Everything is late                                              | H+17                   | Cut Rework, then Repo; at H+19, if Takes isn't working, cut it too and package lenses + session                                                         | P1, but the thesis still lands                             |
| Submission portal or upload trouble                             | H+24                   | Submitting at 11:00 leaves an hour; ask organisers on Discord immediately                                                                    | Nothing, if we don't wait until 11:55                      |

## Demo: two official scripts

Setup: laptop A on the projector with sound to the PA (host audio), laptop B held by the second presenter, same session link already open. The song is preloaded and has been played once to warm the sample cache. Decision.

**Demo B is canonical.** Demo A replaces it only if REWORK = GO at H+19 and it has run clean in every rehearsal since. Both take about 105 seconds and share the first 65, so nobody redesigns the pitch on Sunday morning. The submission video is Demo B unless Rework is GO.

### Demo B: Core (canonical, no AI)

| Time     | Presenter does                                                                                                                     | Audience sees and hears                                                                             | What it proves                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 0–10 s   | "This is Strudel. Music is code." Presses play                                                                                     | Labelled tracks of code; a beat starts                                                              | Starting point everyone understands                |
| 10–25 s  | Hovers the bass `lpf` number, then drags its knob down                                                                             | Number and knob light up together; the digits change as the bass darkens                            | Parameter lens: control and code are one object    |
| 25–40 s  | Clicks two cells in the hats grid                                                                                                  | The hats string rewrites in place; nothing else in the line moves                                   | Rhythm lens with surgical patching                 |
| 40–55 s  | Presenter B adds a step to the bass string on laptop B                                                                             | On the projector, B's ring appears on the bass grid and it updates without anyone touching laptop A | Shared projections, not just shared text           |
| 55–65 s  | B drags the room knob                                                                                                              | A's knob moves by itself, labelled "B"                                                              | Collaboration reaches controls                     |
| 65–80 s  | A opens takes, clicks the take from 30 seconds ago, then restores the latest                                                       | Takes labelled in musical words ("hats 4 to 8"); the earlier version plays                          | Semantic history from the same IR                  |
| 80–95 s  | A points at the `perc:` line: its lens is locked. A edits that line by hand; the lens stays locked and the code is untouched by it | "If we cannot prove an edit is safe, we do not modify the source."                                  | The patcher is engineering, not string replacement |
| 95–105 s | "Code is the source. Lenses are how you play it." Stops audio                                                                      | Silence, name on screen                                                                             | The one-liner                                      |

### Demo A: Full (only if REWORK = GO)

Identical to Demo B for 0–65 s, then:

| Time      | Presenter does                                          | Audience sees and hears                                                                                      | What it proves                                            |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 65–85 s   | Types into the rework bar: "busier hats, keep the kick" | A diff: one string changed. Checks: parses, plays, kick unchanged over 4 cycles. Accept; the hats get busier | Rework consumes the same model, and its edits are checked |
| 85–95 s   | Opens takes, plays "before rework", restores the latest | History you can hear                                                                                         | Semantic history                                          |
| 95–100 s  | Points at the locked `perc:` lens                       | "And where we can't prove safety, we refuse."                                                                | Safe refusal                                              |
| 100–105 s | The one-liner; stops audio                              | Silence, name on screen                                                                                      | Close                                                     |

Rework is always the last musical moment, never the first.

**Repo beat (optional, 15 seconds, the Top 10 pitch and the video only).** It is in neither script, so the 105 seconds stay as rehearsed; it adds 15 seconds after the Takes beat. A opens the Repo chip and shows one change with its musical summary, presses Commit (the message is already "bass lpf 1200 to 430, hats 4 to 8 hits"), then Push to main on a throwaway repo. It runs only if REPO = GO, it has been rehearsed ten times on venue Wi-Fi, and a phone hotspot is ready; otherwise it is skipped without comment. The video may include it if it is recorded on a good network.

Rehearsal rules: Demo B at least ten times before G7, Demo A five more times only if GO; the presenter never types a URL or refreshes; if a step fails, say that step's line and move on.

## Submission experience

We assume judges review submissions on their own between 12:00 and 16:00 (Assumption until organisers confirm). The live link, README, public repo, 2-minute video and the self-guided demo state are part of the product and are built to the same standard as the editor. P0.

### The first 30 seconds on the live link

1. The app opens on the demo song: no login, no empty state, one obvious Play button.
2. A small dismissible first-run strip above the code: "1. Press Play. 2. Turn the highlighted knob and watch the code. 3. Open a second tab to see sync."
3. The bass `lpf` knob wears a `link` outline until it is touched; turning it lights the number in the code.
4. An "Open second tab" button opens the same session in a new tab. The tabs sync through the browser (BroadcastChannel), with no network or account, so turning a knob in one moves it in the other.
5. The locked `perc:` lens shows its lock; hovering it explains why.

Target: a judge experiences the core invention within 20–30 seconds without reading the README. Hypothesis: test it on Saturday evening with two people who haven't seen the project.

### README, in this order

1. The one-line pitch and a short GIF of knob and code moving together.
2. Live link and the 2-minute video.
3. What it proves, in the hierarchy: Music IR → Patcher → Lenses → Collaboration → Takes → Repo (optional) → Rework (optional).
4. Safe refusal: one supported expression with its editable lens, one complex expression that stays read-only, and the rule "if we cannot prove an edit is safe, we do not modify the source".
5. The architecture diagram and the round-trip test count.
6. What is Strudel's and what we built.
7. If Repo shipped: what the Git proxy sees, what the browser stores, and what we never do with a token (see Repo).
8. Licence and attribution.

### Strudel attribution and licence checklist

- [ ] All hackathon code is AGPL-3.0-or-later, with the licence file in the repo root.
- [ ] The app shows a visible "Source" link to the public repo, since the AGPL requires that people using it over a network can get the source.
- [ ] Strudel's copyright and licence notices stay intact in anything we copy or bundle; no headers removed. Check the wording in Strudel's repository at H0.
- [ ] Strudel is credited in the README, the app footer and the video: "Built on Strudel (strudel.cc), AGPL-3.0-or-later."
- [ ] Every self-hosted sample pack's licence is checked and credited in the README.
- [ ] No Strudel logo used as ours and nothing that implies endorsement.

### Video

Demo B (or Demo A if Rework is GO), recorded H21–23 on both laptops with screen capture and audio. Captions carry each step's "What it proves" line, and the last frame shows the hierarchy and the live link. Under 2 minutes.

## Pitch

**5 seconds:** Code is the source. Lenses are how you play it.

**15 seconds:** JamScript is a projectional editor for Strudel music. Every knob and drum grid is a live view of your code, so turning a knob rewrites exactly one number, and everyone in the session sees it move.

**30 seconds:** Live coding music is powerful, but you play it by typing. Visual music tools are playable, but they hide the code. JamScript keeps the code as the only source of truth and draws editable lenses on top: a knob for every filter value, a grid for every simple rhythm. Lenses edit the code surgically, sync across laptops, save every take you play, and let an AI propose musical changes that are checked before you hear them.

**90 seconds (spoken over the demo):** follow the demo table; each step's "What it proves" column is the sentence to say.

**3 minutes:**

1. _Problem (30 s)._ Strudel lets you write music in a browser, and anyone who has tried it knows the moment a pattern clicks. But to change a filter you edit a number by hand, and when you jam with a friend you share text, not instruments. Visual tools fix the playing and lose the code.
2. _Insight (20 s)._ Don't choose. Treat code as canonical and controls as projections of it, an idea from programming-language research (Hazel's livelits, PLDI 2021; puredit, GPCE 2023) that we apply to live-coded music and make shared. Nothing new to save, nothing to drift out of sync.
3. _Demo (105 s)._ As above.
4. _How (20 s)._ A small Music IR built from the editor's syntax tree and Strudel's own mini-notation parser, a lens registry, and one patcher every edit goes through: lenses, collaborators and the AI. That is why the AI can be checked: its edits are lens edits, not free text.
5. _Close (5 s)._ Open source, built on Strudel, AGPL. Code is the source. Lenses are how you play it.

## Judge Q&A

| Question                                            | Answer                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why not just use the Strudel REPL?                  | We use Strudel itself. The REPL has inline sliders you must write into code; we infer controls from ordinary code, cover rhythms too, and sync them between people.                                                                                                                                                                                                                                                 |
| Why not Live Music Coder?                           | It also treats code as the source of truth and derives a visual graph from it, and it does far more than we do: four engines, visualizers, MIDI, a desktop app. For Strudel, though, its graph is view-only. We solve a narrower problem: editable, music-specific projections (rhythm grids, parameter knobs) that round-trip to ordinary Strudel code, sync between collaborators, and feed history and AI edits. |
| Why not Strudel Flow?                               | It is visual-first: you build from nodes and it generates Strudel. Here you write code and the controls come from it.                                                                                                                                                                                                                                                                                               |
| Why not Flok?                                       | Flok is an established collaborative live-coding editor, still developed on Codeberg, that syncs code between performers. We sync the same way, through the text, and add projections on top: when your friend changes the code, the matching knob moves on your screen.                                                                                                                                            |
| That other tool has far more features.              | Yes, and we don't compete on breadth. We show one interaction done safely: bidirectional projections of plain Strudel that are collaborative and feed a semantic history.                                                                                                                                                                                                                                           |
| Isn't this just sliders?                            | A slider is a widget you add. A lens is inferred from code you already wrote, writes back with a minimal change, refuses unsafe edits, and is shared. The grid has no Strudel equivalent.                                                                                                                                                                                                                           |
| Did you invent projectional editing?                | No. It comes from programming-language research: Hazel's livelits (PLDI 2021) and puredit (GPCE 2023), which shows GUI widgets over ordinary Python and JavaScript while the text stays the source. We apply it to live-coded music and make the projections shared.                                                                                                                                                |
| What happens with code the lens doesn't understand? | It stays read-only and the code is untouched. Our editor never guesses: if it can't prove an edit is safe, the lens is read-only.                                                                                                                                                                                                                                                                                   |
| Is the AI doing the work?                           | No. The AI proposes a structured edit in the same language the lenses use. For the supported subset we check it parses, plays, and keeps what you asked to keep by querying the pattern before and after; outside the subset we say "not checked". Then you approve it.                                                                                                                                             |
| Git buttons? VS Code has those. | It does, and ours stay small on purpose: Clone, Add, Commit, Push and Pull for the one open file, never a force push or a merge. What VS Code can't do is name the commit from what changed in the music: "bass lpf 1200 to 430". |
| Does my GitHub token go through your server? | Yes, through our own small proxy, because browsers can't call GitHub's Git endpoints directly. The token lives only for that tab, goes only to github.com, and is never logged or stored by us. The source is public, so you can check. |
| Did you build Strudel?                              | No, and we say so. We built the IR, lenses, patcher, sessions, takes and rework on top of it.                                                                                                                                                                                                                                                                                                                       |
| Who is it for?                                      | Developers who jam: people who can code and want to make music with friends without leaving code.                                                                                                                                                                                                                                                                                                                   |
| What's next?                                        | A lens SDK so others can add lenses, a desktop app, and MIDI. See roadmap.                                                                                                                                                                                                                                                                                                                                          |
| What was hardest?                                   | Mapping edits back to exact characters across two parsers (JavaScript and mini-notation) without disturbing anything else. Show the test count.                                                                                                                                                                                                                                                                     |

## Success metrics

Hackathon (measured before G7, all Decision targets):

| Metric                                      | Target                                                        |
| ------------------------------------------- | ------------------------------------------------------------- |
| First sound after opening the deployed app  | Under 3 s with warm cache                                     |
| Remote lens update on the second laptop     | Under 300 ms on venue Wi-Fi (Hypothesis until measured at G4) |
| Unintended characters changed by lens edits | Zero across 50+ round-trip cases (30 by G3)                   |
| Undo after a lens gesture                   | One gesture = one undo step                                   |
| Rework checks                               | 10 of 10 pre-tested prompts produce a valid, checked diff     |
| Repo (if REPO = GO)                         | 10 of 10 runs of clone, edit, commit, push to a throwaway repo; the commit shows the musical message on GitHub |
| Demo                                        | Under 2 minutes, no refresh, 10 clean rehearsals              |

After the hackathon (Hypothesis): 200 GitHub stars in 3 months, 5 outside contributors, one third-party lens, and weekly returning users measured with privacy-friendly analytics.

## Open source and licensing

Verified: Strudel's packages are AGPL-3.0-or-later, so anything that imports them and is offered over a network must publish its source under the AGPL.

| Package                                                               | Imports Strudel?                      | Hackathon licence | After the hackathon                                                        |
| --------------------------------------------------------------------- | ------------------------------------- | ----------------- | -------------------------------------------------------------------------- |
| `@JamScript/music-ir`: IR types and the extractor from a syntax tree  | No (takes krill output as plain data) | AGPL-3.0-or-later | Consider MIT once we have checked it is genuinely independent (Hypothesis) |
| `@JamScript/lens-kit`: Lens interface, registry, patcher              | No                                    | AGPL-3.0-or-later | Same                                                                       |
| `@JamScript/strudel-adapter`: krill parsing, evaluate, dry-run checks | Yes                                   | AGPL-3.0-or-later | AGPL-3.0-or-later                                                          |
| The app                                                               | Yes                                   | AGPL-3.0-or-later | AGPL-3.0-or-later                                                          |

Decision: everything is AGPL-3.0-or-later for the hackathon. A dual licence gains nothing tomorrow, and whether separately written packages can be MIT is a legal question that package boundaries alone don't settle. Live Music Coder ships such a split (AGPL app, MIT original components), so it is worth investigating after the event, ideally with someone who knows the AGPL.

Hacktoberfest fit: the repo is public from H0, with a `CONTRIBUTING.md`, a `good first issue` label, and three issues prepared for after the event: a Euclidean lens, a `note()` lens, and more parameter specs. Credit Strudel in the README and footer.

## Business model

Hypothesis. Not needed to win; judges may ask.

- **Free and open forever:** the editor, lenses, local sessions and takes.
- **Hosted sessions** beyond a free tier (more people, saved session history), priced like a small hobby plan. Collaboration infrastructure costs money; that is what people pay for.
- **Classrooms:** music or coding teachers running a session for a class, with saved takes as assignments.
- **Not planned:** selling AI credits as the core product. The AI is a feature on top of lenses, and users can bring their own key.

## Roadmap

| When                  | What                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Hackathon (17–18 Oct) | P0 and P1 above                                                                                                                     |
| Rest of October       | Hacktoberfest issues for new lenses; test suite to 100 patterns; write up how the patcher works                                     |
| November              | Lens SDK with docs; Euclidean and `note()` lenses; `stack()` support beyond labelled tracks; Repo: branches, GitHub sign-in, GitLab and Codeberg                                         |
| December              | Desktop app with Tauri (offline, local files); MIDI out                                                                             |
| Q1 2027               | Learn view built from lenses (start from controls, reveal code); Live view for performance (big type, set list); classroom sessions |
| Later                 | OSC; lenses for other languages such as Tidal or Sonic Pi through `music-ir`                                                        |

## Risks

| Risk                                                                | Likelihood | Impact                       | Mitigation                                                                                                                         |
| ------------------------------------------------------------------- | ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Patcher correctness across two parsers** (biggest technical risk) | High       | Lenses corrupt code on stage | Narrow safe subset, a 30-pattern test suite run on every commit, read-only outside the subset, demo song written inside the subset |
| Strudel inside the Lovable build (bundling, AudioContext, SSR)      | Medium     | Lose hours at the start      | Gate G1 at H+2; hand-built Vite fallback                                                                                           |
| Venue Wi-Fi                                                         | Medium     | Session demo fails           | Phone hotspot; same-browser BroadcastChannel fallback; backup video                                                                |
| Browser Git (proxy, token, repo size)                               | Medium     | Repo ships local-only, or not at all | Gated at H+19; proxy smoke test at H0–2; GitHub-only allowlist; shallow single-branch clones; local-only fallback            |
| Lenses as widgets inside CodeMirror (layout, focus, drags) | Medium | Knobs misbehave on stage | Gate G2; fall back to a right-hand panel |
| Audio glitches while dragging                                       | Medium     | Demo sounds broken           | Throttled re-evaluation, re-evaluate on release fallback                                                                           |
| Model latency or bad output                                         | Medium     | Dead air during rework       | Pre-tested prompts, a timeout with replay fallback, checks that block bad output                                                   |
| Judges see "just sliders"                                           | Medium     | Low originality score        | Lead with the grid and the remote knob; the Q&A line on sliders                                                                    |
| Scope creep back to an IDE                                          | High       | Nothing finished             | The scope test; Repo and Rework only if G1–G5 pass by H+19; Repo capped at the buttons listed in Repo                                                                                  |
| Team fatigue                                                        | High       | Demo mistakes                | Sleep shifts H13–17; freeze at H+21; submit at H+24                                                                                |
| Licence misunderstanding                                            | Low        | Rework packaging later       | Default to AGPL everywhere if unsure                                                                                               |

## Deployment

- **Lovable usage (Decision):** Lovable builds the landing page and the first static shell of the editor from the prompts in the tabs. All engine code (IR, lenses, patcher, Strudel adapter) is written by hand in `src/engine/` and synced through GitHub. The one exception is the thin playback adapter, `src/engine/playback.ts`, which `third-prompt-playback.md` asks Lovable to write for G1 so Play makes sound early. If Strudel fights the Lovable build at G1, the editor moves to a hand-built Vite app and Lovable keeps only the landing page. Verified: a Lovable account matters only for the credit stipend and the Lovable prize tracks; the event allows any stack.
- **Hosting (Decision):** Cloudflare Pages, two projects built from GitHub: the landing page at `jamscript.pages.dev` and the editor at `jamscript-app.pages.dev`, a static single-page app (TanStack Start SPA mode in Lovable, or Vite). Samples are copied into the app's own static files so the demo doesn't fetch from GitHub.
- **Git proxy (Decision):** one Cloudflare Pages Function in the editor's project (`functions/api/git/[[path]].ts`, written by hand) forwards Git requests to github.com, because browsers can't call GitHub's Git endpoints directly. It is ours rather than the public `cors.isomorphic-git.org`, since credentials would pass through someone else's server. It allows only `github.com`, only the Git smart-HTTP paths (`info/refs`, `git-upload-pack`, `git-receive-pack`), and only requests from our own origins; it drops cookies and logs no headers or bodies. Free-plan limits (Verified): 100,000 requests a day, 100 MB request bodies, 10 ms CPU per request not counting time spent waiting on the network. Streaming a pack through it staying inside them is a Hypothesis until the H0–2 smoke test.
- **Sessions:** Yjs over Liveblocks, one room per session link; y-webrtc on BroadcastChannel as the offline fallback.
- **Rework:** one edge function (Lovable Cloud or any serverless host) holds the model key, takes the code, IR summary and the request, and returns the intent JSON. The checks run in the browser, not on the server.
- **Desktop and monorepo:** not needed for the hackathon. See the tab "After the hackathon: shipping".

## Names

The name should say "one thing, two views" and work in English everywhere. Checks were partial; anything marked "not checked" needs a search of GitHub, npm and the domain before you commit.

| Name             | Why it fits                                                                                 | Conflict check                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Foldback**     | The stage monitor that lets players hear themselves: feedback loop between code and control | Not checked; common audio term, so check trademark use                                      |
| **Parallax**     | Same object, two viewpoints                                                                 | Not checked; many unrelated products, so the domain is the hard part                        |
| **Twofold**      | Code and lens, one object                                                                   | twofold.dev registered 2020 (Verified); try another TLD                                     |
| Duplex           | Two-way editing                                                                             | Not checked                                                                                 |
| Seam             | Where code and control meet                                                                 | Not checked                                                                                 |
| Isomer           | Same parts, different shape                                                                 | isomer.dev registered 2022 (Verified)                                                       |
| Loupe            | A lens you look through                                                                     | Not checked                                                                                 |
| Refract          | Light through a lens                                                                        | Not checked                                                                                 |
| Mirrorbeat       | Code mirrors the beat                                                                       | Not checked                                                                                 |
| Prismatic        | One source, many views                                                                      | Not checked                                                                                 |
| Lenscape         | Lenses over code                                                                            | Not checked                                                                                 |
| Overdub          | Recording over a take                                                                       | Not checked; music-software term                                                            |
| Patchbay         | Where connections are made                                                                  | Not checked; existing Linux audio tools use the word                                        |
| Facet            | —                                                                                           | Conflict: Facet is an existing live-coding environment (Verified)                           |
| Splice, Overtone | —                                                                                           | Conflict: Splice is a major music company; Overtone is an established Clojure music library |

Name (Decision): **JamScript**, at `jamscript.pages.dev`. The table above lists the earlier candidates.

Terminology (Decision): **Lens** (a control drawn from code), **Take** (a saved version you can hear), **Session** (a shared link), **Rework** (an AI-proposed, checked change). **Repo** (a Git repository you open, change and publish from the top bar; its buttons keep their Git names: Clone, Add, Commit, Push, Pull). Avoid "widget", "snapshot", "room" and "AI assistant" in the UI, and Git's inner words: "stage", "index", "HEAD", "origin", "checkout", "rebase", "detached".

## New scores

Scored as a harsh judge would score the plan, assuming P0 and P1 ship. 9.6 is the target, not the claim; where a score is below it, the last column is the action that would raise it.

| Dimension                | Plan on paper | Target if executed | What gets it there                                             |
| ------------------------ | ------------- | ------------------ | -------------------------------------------------------------- |
| Technical ambition       | 9             | 9.3                | Correctness, not a third lens                                  |
| Technical depth          | 9             | 9.5                | 50+ round-trip cases, safe refusal shown, one-gesture undo     |
| Demo potential           | 9             | 9.8                | Demo B run clean ten times                                     |
| Novelty                  | 8.5           | 8.9                | Grid and remote knob first; cite Hazel and puredit             |
| Feasibility              | 7             | 8.4                | Pass G1–G3 on time; cut Rework at H+19 without debate          |
| Judge understandability  | 9             | 9.7                | Self-guided live link: knob and second tab within 30 seconds   |
| Wow factor               | 8.5           | 9.7                | The knob that moves by itself, readable in the video           |
| Competitor defensibility | 8             | 9.1                | Honest competitor answers; patcher and tests published         |
| Engineering credibility  | 9             | 9.5                | Tests in CI, "built on Strudel" stated plainly                 |
| Submission quality       | 8.5           | 9.7                | Live link, README, repo and video treated as product           |
| Open-source potential    | 9             | 9.3                | Lens good-first-issues posted before submission                |
| Post-hackathon potential | 8             | 9.2                | Lens SDK and first outside contributor                         |
| Pitch clarity            | 9.3           | 9.8                | The hierarchy and the 5-second line, start and end             |
| Memorability             | 9             | 9.8                | Same as wow factor                                             |
| Winning likelihood       | Not scored    | Not scored         | Unknowable until the theme, criteria and other teams are known |

Our strict reading of the plan on paper averages about 8.6; an outside review put it nearer 9. If the build lands, the targets average about 9.4. Nobody should call it 9.6 before it exists, but clean execution can make it perform at that level. The remaining gap is execution, not concept. These scores were set on 16 October, before Repo was added, and have not been re-scored. Repo is gated; if it ever costs hours from P0 or P1, the gate is what gets cut.

## Open questions

- What is the theme? Announced at kickoff at 11:00; use the theme adaptation table within the first hour.
- What are the judging criteria, and what must a submission contain (video, repo, live link)? Ask on Discord tonight.
- Can code change after the 12:00 deadline, for example before a Top 10 pitch? Assume not.
- How long is a Top 10 slot? About 7 minutes going by the agenda; confirm.
- Team size: 2 or 4? The build plan has roles for both, and two people should skip Rework unless P0 is done early.
- Which model and key for Rework, and who pays? Decide at G0.
- Which GitHub account and throwaway repo do we use for the smoke test, rehearsals and the demo? Decide at G0, and make a fine-grained token limited to that repo.
- Does the venue allow a phone hotspot and give a sound feed for the pitch?

## Sources

Hackathon

- [Hacktoberfest Georgia](https://hacktoberfest.ge/) · [Agenda](https://hacktoberfest.ge/agenda)
- [Hacktoberfest Tbilisi 2025, GDG Tbilisi](https://gdg.community.dev/events/details/google-gdg-tbilisi-presents-hacktoberfest-tbilisi-2025)
- [FlipMyRoom write-up, davidb.dev](http://davidb.dev/blog/hacktoberfest-tbilisi)

Strudel and editor stack

- [Strudel](https://strudel.cc/) · [Packages](https://strudel.cc/technical-manual/packages/) · [Visual feedback](https://strudel.cc/learn/visual-feedback/) · [Source on Codeberg](https://codeberg.org/uzu/strudel)
- Strudel 1.3.0 package sources from the npm registry (transpiler, mini-notation parser, `slider.mjs`), read and tested locally
- [y-codemirror.next](https://github.com/yjs/y-codemirror.next) · [Liveblocks CodeMirror + Yjs guide](https://beta.liveblocks.io/docs/guides/how-to-create-a-collaborative-code-editor-with-codemirror-yjs-nextjs-and-liveblocks) · [Liveblocks pricing](https://liveblocks.io/pricing)
- [TanStack Start SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode) · [Lovable docs](https://docs.lovable.dev/llms.txt) · [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

Git in the browser

- [isomorphic-git quickstart](https://isomorphic-git.org/docs/en/quickstart) · [Authentication](https://isomorphic-git.org/docs/en/authentication) · [cors-proxy](https://github.com/isomorphic-git/cors-proxy)
- [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

Competitors and prior art

- [Flok on GitHub (archived; development moved to Codeberg)](https://github.com/munshkr/flok) · [Flok on Codeberg](https://codeberg.org/munshkr/flok)
- [Live Music Coder](https://github.com/arnoldwender/wm-prototyp-live-music-coder) · [case study](https://arnoldwender.com/en/blog/live-music-coder-case-study/)
- [Strudel Flow](https://github.com/xyflow/strudel-flow) · [Step sequencer with Strudel](https://alexcodesart.com/building-a-step-sequencer-with-strudel-creative-coding-meets-visual-beat-making/)
- [StrudelLM](https://github.com/tambo-labs/strudellm) · [Apfelstrudel](https://github.com/rcarmo/apfelstrudel) · [seqbaby PR #138](https://github.com/mjoslyn/seqbaby/pull/138) · [Strudel MCP](https://lobehub.com/mcp/takeachangs-strudel-mcp)
- [Estuary](https://www.github.com/dktr0/estuary) · [EarSketch, CACM](https://cacm.acm.org/research/earsketch) · [Topos](https://synth.playtronica.com/topos) · [Facet](https://codeberg.org/nnirror/facet)
- Omar et al., "Filling Typed Holes with Live GUIs" (Hazel livelits), PLDI 2021
- Korz and Andrzejak, [Virtual Domain Specific Languages via Embedded Projectional Editing](https://2023.splashcon.org/details/gpce-2023-papers/10/Virtual-Domain-Specific-Languages-via-Embedded-Projectional-Editing), GPCE 2023 · [puredit source](https://github.com/niklaskorz/puredit)

## If everything goes wrong

The absolute minimum submission that still proves the thesis:

- Strudel playback
- Music IR
- Safe patcher
- Parameter lens
- Rhythm lens
- Two-tab synchronization
- A clean 90–120 second video

Everything else can disappear.

</details>
