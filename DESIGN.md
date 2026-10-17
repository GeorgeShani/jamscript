---
name: "JamScript"
description: "A projectional music editor on Strudel: the code is the source, and knobs and step grids are live views of it."
colors:
  stage: "oklch(0.195 0.030 278)"
  panel: "oklch(0.225 0.032 278)"
  floating: "oklch(0.255 0.033 278)"
  floating-shadow: "oklch(0.10 0.02 278 / 55%)"
  hover-row: "oklch(0.285 0.032 278)"
  hairline: "oklch(0.335 0.030 278)"
  control-edge: "oklch(0.560 0.030 278)"
  selection: "oklch(0.400 0.060 278)"
  paper: "oklch(0.940 0.014 85)"
  paper-dim: "oklch(0.750 0.020 278)"
  record-amber: "oklch(0.820 0.140 72)"
  patch-cyan: "oklch(0.820 0.110 205)"
  rework-violet: "oklch(0.740 0.140 300)"
  fail-red: "oklch(0.680 0.190 25)"
  pass-green: "oklch(0.800 0.150 150)"
  caution-yellow: "oklch(0.880 0.150 100)"
  track-sky: "oklch(0.740 0.130 243)"
  track-rose: "oklch(0.740 0.160 342)"
  track-moss: "oklch(0.700 0.130 153)"
  track-mustard: "oklch(0.780 0.160 105)"
  track-clay: "oklch(0.740 0.100 42)"
  track-lilac: "oklch(0.860 0.100 315)"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  ui:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
  code:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.85
    fontFeature: "tnum"
  code-small:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  gutter:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 2.36
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.record-amber}"
    textColor: "{colors.stage}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-outline:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-marketing:
    backgroundColor: "{colors.record-amber}"
    textColor: "{colors.stage}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  input:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  lens-cell-on:
    backgroundColor: "{colors.record-amber}"
    rounded: "{rounded.sm}"
    size: "24px"
  lens-cell-off:
    backgroundColor: "{colors.hover-row}"
    rounded: "{rounded.sm}"
    size: "24px"
  take-chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  popover:
    backgroundColor: "{colors.floating}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "8px"
---

# Design System: JamScript

This file is normative for both surfaces, each its own Cloudflare Pages project: the editor (`jamscript-app.pages.dev`) and the landing page (`jamscript.pages.dev`). Where a decision is not covered, ask instead of inventing a style.

## Overview

**Creative North Star: "The Patch Cable"**

A cable runs from a control to the exact characters of code it changes. That is the whole product, and it is the only thing the design is allowed to show off. The room around it is a dim indigo studio at night: warm paper-coloured text, one amber record light for the single action, and a few cable colours that say who or what a thing belongs to.

The physical scene decides dark: two friends on laptops with headphones on, in a dim room, the screen the only light. The landing page keeps the same room so the demo on it is the product, not a picture of it; its text is set at high contrast so it also reads on a projector in a bright hall.

The editor is an Operate surface: it is first a working music tool, and the world lends only type, palette, density and one signature move. The landing page is a Persuade surface: it must make the offer clear in seconds, expose the action, and prove the mechanism with a live, draggable demo. Neither surface performs a costume of a hardware sequencer, a terminal or a stage.

**Key Characteristics:**

- One signature move: the linked highlight, in `patch-cyan`, used for nothing else.
- Restrained colour in the editor: indigo room, amber only for the action and the "on" states, tracks as dots and rings.
- Dense, aligned, standard controls (shadcn, audiocn knobs); expression never replaces a familiar affordance.
- Flat by default; one shadow, on floating layers only.
- Dark only. Fixed type scale in the editor, fluid only for two marketing headings.

## Colors

A committed indigo room with warm paper text. Hues are assigned to roles, and a hue never plays two roles.

### Primary

- **Record Amber** (`oklch(0.820 0.140 72)`, #FCB452): the single action colour. Primary buttons, Play while playing, focus ring, active step cells, the current take's outline. Text on it is `stage` (10.3:1).

### Secondary

- **Patch Cyan** (`oklch(0.820 0.110 205)`, #5ED9E6): the linked highlight only: the 2px outline on a hovered, focused or dragged lens, the matching code range at 25% fill, and the 400ms flash after a local edit.
- **Rework Violet** (`oklch(0.740 0.140 300)`, #B995F6): Rework's identity: its sparkle icon, status text and diff header. Never a diff colour.

### Tertiary

- **Cable colours** (tracks and people): Sky `oklch(0.740 0.130 243)` #58B3F6, Rose `oklch(0.740 0.160 342)` #ED7EC7, Moss `oklch(0.700 0.130 153)` #55B577, Mustard `oklch(0.780 0.160 105)` #C7BC1C, Clay `oklch(0.740 0.100 42)` #E19678, Lilac `oklch(0.860 0.100 315)` #EABDFE. Tokens `track-1` to `track-6` in that order.
- **Pass Green / Fail Red / Caution Yellow** (#6ED889, #F75D59, #EFD956): diff additions and deletions, passed and failed checks, saved and error states, solo and mute. Never track colours.

### Neutral

- **Stage** (#121322): page and editor ground.
- **Panel** (#181A2B): top bar, takes rail, rework bar.
- **Floating** (#1F2133): menus, tooltips, the command palette.
- **Hover Row** (#26293A): hover rows, inactive tabs, rest cells.
- **Hairline** (#333546): 1px dividers (decorative; never the only edge of a control).
- **Control Edge** (#707386): borders of inputs and rest cells; 3.7:1 on Panel, so a control's boundary is always visible.
- **Paper** (#EFEBE1): text, 15.4:1 on Stage. **Paper Dim** (#ABADBB): secondary text, 8.2:1 on Stage, 6.5:1 on Hover Row.

### Named Rules

**The Patch Cable Rule.** Cyan means "this control and these characters are the same thing". It appears nowhere else, not in links, not in focus, not in charts.

**The One Action Rule.** Amber marks the thing to press or the thing that is on. On any screen it covers a small fraction of the pixels; its rarity is how the eye finds Play.

**The Role Hue Rule.** Role colours (amber, cyan, violet, red, green, yellow) are fills, outlines and text on UI. Cable colours are only dots, rings, cursors and flashes. Never use a role colour as a track colour or the reverse. Tracks always also carry their label text; people always also carry initials.

**The Tokens Only Rule.** No hex, rgb or hsl in components and no Tailwind palette classes (`bg-zinc-900`, `text-white`). Everything goes through the tokens in "Paste-ready CSS".

## Typography

**Display Font:** Schibsted Grotesk (with ui-sans-serif, system-ui)
**Body Font:** Schibsted Grotesk
**Label/Mono Font:** Martian Mono (with ui-monospace)

**Character:** A plain, slightly newsy grotesk carries every word; a mono carries only code, numbers that change while music plays, and repo identifiers (branch, file path, commit id). Words are never set in mono to look technical.

### Hierarchy

Editor (fixed rem, root 16px, ratio about 1.15; no fluid sizes):

- **Badge** (500, 0.6875rem / 11px, 1.45): status bar and avatar initials only.
- **Label** (500, 0.75rem / 12px, 1.35): panel headers, lens parameter names, menu items, take labels. Sentence case, no tracking.
- **UI** (400, 0.8125rem / 13px, 1.55): buttons, inputs, default text.
- **Code** (Martian Mono 400, 0.875rem / 14px, 1.85 so rows are 26px, `font-stretch: 87.5%`, tabular numerals): the code in the editor and in demos.
- **Mono small** (Martian Mono 400, 0.8125rem / 13px, 1.55, `font-stretch: 87.5%`, tabular numerals): lens values ("1.2 kHz"), tempo ("0.60 cps"), branch names, file paths and short commit ids.
- **Dialog / empty title** (600, 1rem / 16px and 1.25rem / 20px): rare.

Marketing (Persuade; two fluid steps allowed):

- **Display** (600, `clamp(2.5rem, 6vw, 5rem)`, 1.02, -0.03em, `text-wrap: balance`): the hero headline only. Maximum three lines at any width.
- **Headline** (600, `clamp(1.75rem, 3vw, 2.5rem)`, 1.15, -0.015em, `text-wrap: balance`): section headings.
- **Lead** (400, 1.25rem / 20px, 1.5): one paragraph under the hero headline.
- **Body** (400, 1.0625rem / 17px, 1.65): never wider than 64ch.
- **Caption** (400, 0.875rem / 14px, 1.45).

### Named Rules

**The Code Face Rule.** Martian Mono sets code, track labels like `drums:`, numbers (tempo, values, times) and repo identifiers (branch names, file paths, short commit ids), which are code. The headline, the wordmark, buttons and every sentence are Schibsted Grotesk.

**The Two Faces Rule.** Only Schibsted Grotesk (weights 400, 500, 600) and Martian Mono (400, 500). Never add or swap a font. No italics, no all-caps, no letter-spaced labels, no kicker or eyebrow above a heading.

## Layout

### Current editor: compact and functional (17 October 2026)

After seeing the larger revision, the user requested smaller controls and working code editing, knobs and steps. This revision supersedes the roomier dimensions below. Use a real CodeMirror document with source-derived block widgets, 14px code on 26px rows, 13px UI text, 24px steps and 28px knobs. The desktop toolbar is 48px, switching below 900px to 40px and 36px rows. Takes uses 28px chips; Rework uses 30px controls in an approximately 60px footer. Knob name and value share a single line beside the control. No static-code preview or first-use disclaimer above the actual editor.

Code is directly editable, with Ctrl/Cmd+Enter to evaluate. While playing, valid source changes update playback after a short debounce. Grid cells and knobs patch their own source tokens, with one shared undo history; a drag is one undo step. Flat sound/rest patterns up to 16 steps and numeric gain/room/lpf/hpf arguments have controls. Complex patterns remain editable as code with a visible locked lens. Double-click a knob or click its value to type a number. Initial song data is a fixture, not a second document. Takes, Repo, presence and Rework remain labeled examples, and must not apply fixture changes to live source.

Preserve the palette, typography families and single-column editor. Keep the editor compact at normal browser zoom; allow its own scrolling rather than expanding every source line into a large track section.

### Editor revision: roomier code-first workspace (17 October 2026)

The user selected a roomier code-first editor after reviewing the published shell. This revision takes precedence over the original dense editor dimensions below; the palette, two fonts, single document, inline lens relationships and safe preview boundaries remain unchanged.

- Desktop toolbar: 72px with 36px controls. Below 900px it becomes two rows (52px and 44px), keeping Play in the first row. Horizontal padding is 32px on desktop and 16px on phones.
- Editor UI text: 14px. Source and review code: 16px on 32px rows with 95% font stretch. Line numbers stay 12px; secondary labels 12px and numeric values 13px. This supersedes the earlier 13px UI and 14px code sizes.
- The code document is at most 1440px wide, centered within the scroll area, with 24px top padding, 32px horizontal padding and 20px between statements. On phones horizontal padding becomes 16px. Do not center or box each track separately.
- Rhythm cells are 36px (32px on phones); knobs are 44px (40px on phones). Parameter names and values sit in a compact two-line group beside the knob. Lens strips retain their track rule and exact source mappings, with more breathing room between controls.
- Takes use one calm row of 36px chips and an Examples label. The longer disconnected-action explanation appears when a Take is selected, while its accessible description remains available at all times. The row grows for selected actions rather than clipping them.
- Rework has a 40px input and action, with a quiet helper row and persistent Strudel attribution, in an approximately 88px footer. Phone controls are 36px. Preview disclosures must stay truthful without filling the workspace with repeated warnings.
- Code and reviews scroll locally. Do not shrink the whole interface to force every sample track onto a short screen. Keep the editor the dominant surface; no additional panels, dashboards or fake engine behavior.

Editor: one screen, no modes, no file explorer, no activity bar. The one place files are listed is the Repo popover, as a flat list of paths.

```
Top bar 44px     name, session name, repo chip, avatars, tempo, Play/Stop, Share
Editor (Stage)   full width; each track's lens strip sits directly under its line of code
Takes rail 56px  one chip per take, newest on the right
Rework bar 48px  "Ask for a change"; opens an inline diff panel over the editor area
```

Panels sit flush and are divided by 1px Hairline lines. Hierarchy comes from surface steps (Stage, Panel, Floating), not shadows. Below 1024px nothing moves: the editor is already one column, and a strip's controls wrap onto a second row. Spacing is a 4px grid; the editor uses 4, 8, 12, 16.

Marketing: max content width 1120px, 24px side padding on mobile, left-aligned throughout, sections 96px apart on desktop and 64px on mobile with more space above a heading than below. Sections are separated by space and a 1px Hairline top line, not boxed cards, and never a grid of identical icon cards. The hero is stacked, not split: headline, lead and two buttons on top, then the live demo at the full 1120px width, whose top edge is visible in the first viewport at 1440 by 900. Later sections each carry one small authentic artifact (a real-looking locked lens, a presence ring, a take chip row, a diff) so the page changes shape as it goes.

Lens strips: a track's lenses form one strip under the last line of the track's statement, in code order, the rhythm lens first and then parameter knobs. The strip is indented to the code column, has a 2px rule down its left edge in the track's colour, 8px of padding above and 12px below, and no fill: it sits on Stage so the code and its controls read as one document. A line with no lens has no strip. When no track has a lens, one line under the code in Paper Dim says "No lenses yet. Label a track, like `drums:`, to get one." The first-run card is a one-line strip above the code: Panel fill, 36px, with a Dismiss icon button. Tracks take colours in the order their labels appear in the code (`drums:` is track-1), wrapping after track-6. Collaborators take colours in join order starting at track-6 and counting down.

## Elevation & Depth

Flat by default. Depth is tonal (Stage, Panel, Floating) plus 1px lines. Only floating layers (menus, popovers, tooltips, command palette, toasts) have a shadow, and all use the same one.

### Shadow Vocabulary

- **Floating** (`box-shadow: 0 12px 32px oklch(0.10 0.02 278 / 55%), 0 0 0 1px var(--border)`): menus, popovers, tooltips, palette, toasts.

### Named Rules

**The Flat Room Rule.** Nothing at rest has a shadow. No glow, no blur, no glass, no gradient, no decorative background pattern. There are no dialogs in v1; the Rework diff is an inline panel, not a modal.

## Shapes

Small, calm, rectangular: `--radius` is 6px. Buttons, inputs, chips and badges use 6px; menus and popovers 8px; rhythm cells 4px. Editor panels and the editor itself have no radius and meet at 1px lines. Knobs are circles (audiocn). No pill shapes, no left-border accent stripes on cards or callouts.

## Components

Every interactive component ships with default, hover, focus, active, disabled, loading and error states, and the same vocabulary on every screen.

### Buttons

- **Shape:** 6px radius, 28px high in the editor (`size="sm"`), 40px on marketing.
- **Primary:** Record Amber fill, Stage text. Play turns into a filled "Stop" with a Square icon while playing; stopped it is an outline "Play" with a Play icon.
- **Hover / Focus / Active:** hover brightens the fill slightly or shows Hover Row; focus is always a 2px Record Amber outline with 2px offset; active darkens one step; disabled is 50% opacity with no pointer.
- **Secondary / Outline / Ghost / Destructive:** shadcn variants through tokens, never per-instance classes.

### Chips (takes)

- **Style:** Panel fill, 1px Control Edge border, time and musical label ("hats 4 to 8") plus a track dot. The current take has a 1px Record Amber outline; a selected chip shows a "Restore" button.

### Inputs / Fields

- **Style:** Stage fill, 1px Control Edge border, 6px radius, amber caret.
- **Focus:** the 2px amber outline. **Error:** destructive text under the field naming the problem and the fix. **Disabled:** 50% opacity.

### Navigation

- Top bar only, 44px, Panel fill, bottom border. No side nav. Marketing header is 64px: wordmark in Schibsted Grotesk 600, "Docs", "Source", and a primary "Open the editor".

### Lenses (signature component)

- **Parameter lens:** an audiocn knob, 32px, with the parameter name (Label) and the value in mono small with its unit to its right on one line ("lpf 1.2 kHz"). The landing demo uses a 56px knob with the same pieces under it. Log scale for `lpf` and `hpf`. It is a slider for assistive tech: arrow keys step, Shift plus arrow steps by ten, double-click to type a value.
- **Rhythm lens:** square 24px cells, 4px gap, grouped in fours. On: Record Amber. Off: Hover Row with a 1px Control Edge border. Toggle buttons with `aria-pressed`. Subdivisions (`hh*4`) show tick marks.
- **Linked highlight:** hover or focus a lens: 2px Patch Cyan outline on the lens, its code range gets a 25% Patch Cyan background; hover a number or string in the code and the reverse happens. While dragging both stay lit; on release the changed characters flash for 400ms.
- **Locked lens:** drawn at 50% opacity in its strip, with a Lock icon and the label "Edit this one in code"; the tooltip says "Edit this one in code. This pattern is outside what a lens can change safely." Never hidden, never editable.
- **Remote change:** a collaborator's edit shows their 2px presence ring and initials badge on the lens, and flashes the changed characters in their cable colour for 400ms on every client.
- **Loading:** skeleton strips in Hover Row under each labelled line while the code is parsed. **Empty:** "No lenses yet. Label a track, like `drums:`, to get one."

### Code editor (CodeMirror theme)

- Stage background; code at 14px on 26px rows; gutter line numbers in Paper Dim at 60%; active line Hover Row at 40%; selection `selection`.
- Syntax highlighting is always on, in the editor and in every demo. Function and method names (`s`, `note`, `lpf`, `setcps`) use `syn-function`; numbers `syn-number`; mini-notation strings `syn-pattern`, with `~`, brackets and the `*`, `<` and `>` operators inside them in Paper Dim so the rhythm reads; keywords (`const`, `let`, `return`, `=>`) `syn-keyword`; comments `syn-comment`; track labels like `drums:` in Paper at weight 500; punctuation and everything else Paper. No syntax colour is cyan: Patch Cyan belongs to the linked highlight, so `syn-function` is a pale periwinkle.
- Strudel's own note highlighting while playing stays on, restyled to the playing track's colour at 35%; off under reduced motion. It is Strudel's feature; credit it.
- Collaborator cursors: 2px caret in their colour with a name label (Badge, Stage text on their colour) that hides after 2s idle. Errors: wavy Fail Red underline, message on hover and in a one-line strip; the last good version keeps playing.

### Rework (violet)

- Bar: input with a Sparkles icon in Rework Violet. Result: inline unified diff (`@codemirror/merge`, green and red at 20%) with three checks (Parses, Plays, Keeps what you asked), each with an icon and text, and buttons "Accept change" (primary, disabled until all pass) and "Discard".

### Repo (popover)

- **Chip (top bar):** outline button style, 28px high: a GitBranch icon, the branch name in mono (cut at 12 characters), and the change count in plain words when there are changes ("1 change", "3 changes"). No dot and no colour for state; the words carry it. With no repo open the chip reads "Repo" with the same icon.
- **Popover:** Floating fill, 8px radius, the Floating shadow, 360px wide, 8px padding, sections 12px apart and divided by 1px Hairline lines. Not modal: Esc and a click outside close it, nothing behind it dims, and focus returns to the chip. Its height stops at the viewport minus 64px and it scrolls inside, with the tinted scrollbar.
- **Sections, top to bottom:** the repo and branch (`owner/name` and the branch, both mono); Files, a flat list of song paths in mono with the open one marked "Open"; Changes; Ready to commit; the message field with Commit; Push and Pull; History, the last five commits (message in 13px Schibsted Grotesk on one line, short commit id and relative time in mono at Paper Dim). A section with nothing in it is left out, not shown empty.
- **File rows:** 32px, Hover Row on hover. The file path in mono, a plain word for its state ("Changed"), and the counts as "+2 -2" in mono; the signs say what the colour (Pass Green for additions, Fail Red for removals) also says. Under the path, the musical summary in UI text at Paper Dim. Clicking a row opens the unified diff inline over the editor, the same panel as Rework (green and red at 20%), titled "Changes in night-bus.js" with a "Close" button. Only one inline panel is open at a time.
- **Buttons:** Clone, Commit, Push to main and Pull are 28px. The popover shows one primary button at a time, the next sensible step: Clone before a repo exists, then Commit once something is ready, then Push to main after a commit. Every other button is outline. Add, Add all and Remove are ghost. The Push button always names its branch.
- **Icons (lucide only, no arrow icons):** GitBranch (chip), FolderGit2 (Clone), GitCommitHorizontal (Commit), CloudUpload (Push), CloudDownload (Pull), History (History heading), FileText (file rows).
- **Fields:** the clone URL, commit message (textarea, 2 rows, grows to 4), name, email and token all use the Inputs style. The token field is `type="password"` with the helper text "Used only for this tab. Make a fine-grained token on GitHub with Contents: Read and write for this repo." Errors sit under the field in destructive text and name the problem and the fix.
- **Busy:** the button's label becomes the verb in progress ("Cloning", "Pushing"), one line of progress text with its number in mono ("Receiving 40%") sits under the buttons, and the other buttons are disabled. No spinner.
- **States:** no repo (the Clone form); open and clean ("Nothing to commit. Your song matches main."); changes; ready to commit; ahead ("1 to push"); behind ("2 to pull"); diverged (the refusal text); offline; token needed; token refused.
- **Keyboard:** Enter or Space opens the chip; Tab follows the sections top to bottom; Ctrl+Enter in the message field commits when Commit is enabled.

### Browser surfaces

Selection, caret, focus ring, scrollbars, link underlines and numerals are themed from the palette, not left to browser defaults (see the base layer below). Native scrollbars are tinted, not replaced.

## Do's and Don'ts

### Do:

- **Do** use only tokens; fill buttons with `stage` text, never white.
- **Do** make every control and its code light together (Patch Cable Rule), in both directions.
- **Do** pair every colour meaning with an icon, label, shape or initials.
- **Do** keep transitions 150ms with `cubic-bezier(0.2, 0, 0, 1)`; dropdowns and popovers fade and scale from 98%.
- **Do** write like a musician: Lens, Take, Session, Rework, track, pattern, tempo, jam. Buttons say what happens: "Play", "Stop", "Share", "Accept change", "Discard", "Restore". Toasts: "Link copied", "Change accepted", "Take restored", "Committed", "Pushed to main".
- **Do** name Repo's buttons as Git does (Clone, Add, Commit, Push, Pull) and put a plain sentence under any that could surprise. Never show Git's inner words: stage, index, HEAD, origin, checkout, rebase, detached.
- **Do** write errors that name the problem and the fix, without apologising: "This pattern has an unclosed bracket on line 4. Close it to play."
- **Do** respect `prefers-reduced-motion`: the demo shows its end state, note highlighting is off, flashes become a static outline.

### Don't:

- **Don't** use gradients, glows, glassmorphism, blur, neon, hard offset shadows or decorative patterns.
- **Don't** use a kicker, eyebrow, section number, all-caps label or letter-spaced label.
- **Don't** use mono for sentences, headings or buttons; no "technical" costume.
- **Don't** use emoji, Unicode glyph icons, or "→" in buttons and links. Icons are `lucide-react` only.
- **Don't** join meta information with " · ".
- **Don't** put cyan, amber or violet on tracks, or a track colour on a role.
- **Don't** add a light theme, a modal for a task that can be inline, or any entrance animation in the editor. Marketing has exactly one orchestrated moment: the hero demo's loop. No scroll-triggered fade-ins.
- **Don't** lay features out as identical icon cards.

## Paste-ready CSS (for Lovable)

Tailwind v4 + shadcn/ui. Replaces the default shadcn theme. `:root` and `.dark` hold the same values on purpose; `<html>` always has `class="dark"`. Paste only what is inside the code block, not the ``` lines around it.

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root,
.dark {
  color-scheme: dark;
  --radius: 0.375rem;

  /* Surfaces */
  --background: oklch(0.195 0.03 278); /* #121322 stage */
  --foreground: oklch(0.94 0.014 85); /* #EFEBE1 paper */
  --card: oklch(0.225 0.032 278); /* #181A2B panel */
  --card-foreground: oklch(0.94 0.014 85);
  --popover: oklch(0.255 0.033 278); /* #1F2133 floating */
  --popover-foreground: oklch(0.94 0.014 85);
  --muted: oklch(0.285 0.032 278); /* #26293A hover row, rest cell */
  --muted-foreground: oklch(0.75 0.02 278); /* #ABADBB paper dim */
  --border: oklch(0.335 0.03 278); /* #333546 hairline (decorative) */
  --input: oklch(0.56 0.03 278); /* #707386 control edge, 3:1 or more */

  /* Action */
  --primary: oklch(0.82 0.14 72); /* #FCB452 record amber */
  --primary-foreground: oklch(0.195 0.03 278);
  --secondary: oklch(0.285 0.032 278);
  --secondary-foreground: oklch(0.94 0.014 85);
  --accent: oklch(0.285 0.032 278); /* hover and selected surface, not a hue */
  --accent-foreground: oklch(0.94 0.014 85);
  --ring: oklch(0.82 0.14 72);

  /* Status */
  --destructive: oklch(0.68 0.19 25); /* #F75D59 */
  --destructive-foreground: oklch(0.195 0.03 278);
  --success: oklch(0.8 0.15 150); /* #6ED889 */
  --warning: oklch(0.88 0.15 100); /* #EFD956 */

  /* Roles: each owns one hue */
  --link: oklch(0.82 0.11 205); /* #5ED9E6 patch cyan: linked highlight only */
  --ai: oklch(0.74 0.14 300); /* #B995F6 rework violet */

  /* Cable colours: tracks and people, dots and rings only */
  --track-1: oklch(0.74 0.13 243); /* #58B3F6 sky */
  --track-2: oklch(0.74 0.16 342); /* #ED7EC7 rose */
  --track-3: oklch(0.7 0.13 153); /* #55B577 moss */
  --track-4: oklch(0.78 0.16 105); /* #C7BC1C mustard */
  --track-5: oklch(0.74 0.1 42); /* #E19678 clay */
  --track-6: oklch(0.86 0.1 315); /* #EABDFE lilac */

  /* Code */
  --selection: oklch(0.4 0.06 278); /* #404468 */
  --syn-comment: oklch(
    0.68 0.02 278
  ); /* #9597A5, 5.0:1 on rest cells and active line */
  --syn-keyword: oklch(0.78 0.12 300); /* #C3A5F9, 4.5:1 inside a selection */
  --syn-function: oklch(0.84 0.09 262); /* #ABCBFF, not cyan: cyan is the linked highlight */
  --syn-number: oklch(0.8 0.11 35); /* #FCA48D */
  --syn-pattern: oklch(0.86 0.12 78); /* #FCC771 */

  /* audiocn meter tokens */
  --meter-ok: var(--success);
  --meter-warn: var(--warning);
  --meter-clip: var(--destructive);
  --channel-mute: var(--muted-foreground);
  --channel-solo: var(--warning);
  --channel-monitor: var(--link);

  /* shadcn chart + sidebar tokens */
  --chart-1: var(--track-1);
  --chart-2: var(--track-2);
  --chart-3: var(--track-3);
  --chart-4: var(--track-4);
  --chart-5: var(--track-5);
  --sidebar: var(--card);
  --sidebar-foreground: var(--foreground);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--muted);
  --sidebar-accent-foreground: var(--foreground);
  --sidebar-border: var(--border);
  --sidebar-ring: var(--ring);
}

@theme inline {
  --font-sans: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Martian Mono", ui-monospace, "SFMono-Regular", monospace;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-link: var(--link);
  --color-ai: var(--ai);
  --color-track-1: var(--track-1);
  --color-track-2: var(--track-2);
  --color-track-3: var(--track-3);
  --color-track-4: var(--track-4);
  --color-track-5: var(--track-5);
  --color-track-6: var(--track-6);
  --color-selection: var(--selection);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) * 1.35);
}

@layer base {
  * {
    @apply border-border;
  }
  html {
    scrollbar-color: var(--input) var(--background);
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
  ::selection {
    background: var(--selection);
    color: var(--foreground);
  }
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  input,
  textarea,
  [contenteditable] {
    caret-color: var(--primary);
  }
  input[type="range"],
  input[type="checkbox"] {
    accent-color: var(--primary);
  }
  a {
    text-underline-offset: 0.2em;
    text-decoration-thickness: 1px;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
}
```

Fonts, in the document head:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Martian+Mono:wdth,wght@75..112.5,100..800&family=Schibsted+Grotesk:wght@400..900&display=swap"
  rel="stylesheet"
/>
```

Verified contrast (WCAG): Paper on Stage 15.4:1, Paper Dim on Stage 8.2:1 and on Hover Row 6.5:1, Record Amber on Stage 10.3:1, Stage text on every role fill 5.8:1 or more, every cable colour at least 5.7:1 on Hover Row, Control Edge 3.9:1 on Stage, 3.7:1 on Panel and 3.1:1 on Hover Row. Do not recompute by eye; if you change a token, recheck these. Syntax colours (computed): `syn-function` #ABCBFF is 11.1:1 on Stage and 5.7:1 inside a selection; `syn-keyword` 8.8:1, `syn-number` 9.4:1 and `syn-pattern` 11.9:1 on Stage.

## Before you finish any screen

- [ ] Only tokens; no hex values or Tailwind palette colours in components
- [ ] Only Schibsted Grotesk and Martian Mono; mono only for code, labels like `drums:`, numbers and repo identifiers
- [ ] No kicker, no all-caps, no arrows in buttons, no gradients, glows or extra shadows
- [ ] Cyan appears only as the linked highlight; no track colour on a role or the reverse
- [ ] Every interactive element has hover, focus, active, disabled, loading and error states
- [ ] Keyboard works; knobs are sliders; cells are toggle buttons; focus ring visible
- [ ] Reduced motion respected
- [ ] Every lens lights its code, and its code lights the lens
- [ ] Checked at 1280 and 1920 (editor) and 375 and 1440 (landing)
