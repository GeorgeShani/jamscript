# Changelog

## 0.3.8

- Plainer words: saved versions now live in a **History** tab, and the docs and README explain controls, history and the assistant without jargon.
- A new tagline: "Write the music. Shape it with your hands."
- The stage presentation is cleaner, with smaller titles, no bottom bar and no stray accent lines, and the shared-song animation sweeps the full width.

## 0.3.7

- Phones: a calmer one-row toolbar with a More menu, a thumb-reach Play button, bottom tabs, wrapped and slightly smaller code, finger-sized controls, and a row of coding keys (brackets, quotes, `~ < > .`) above the keyboard.
- Sound plays on iPhones with the silent switch on, and resumes after you switch apps.
- Sounds browser: a Sounds button, every sample reachable (search, banks, Show all), a pinned preview with copyable code, and an expandable bottom panel.
- The editor closes brackets and quotes as you type; export length is chosen in seconds or minutes; tempo settings are explained in plain words.

## 0.3.6

- Restored the 128-voice limit that never applied, shared reverb impulses between tracks, and let the scheduler plan further ahead, for steadier playback.
- Typing and knob drags do far less work: one analysis per edit, one knob update per frame, and a quieter, memoized interface.
- Faster page loads: long-lived caching for assets, smaller fonts, a workbench script that is a seventh of its former size, and lazy loading of collaboration and Git code.
- Faster assistant and shared-project requests, and the assistant now uses OpenRouter only.
- The desktop app keeps sign-in credentials in memory and no longer freezes saves during a Git push.

## 0.3.5

- Faster, steadier playback: the default sample catalogues ship with the app, a song’s samples are fetched while you edit, and Play starts once the first cycle is ready.
- The audio scheduler plans further ahead and runs on a worker clock, so a busy or hidden window no longer drops notes.
- Less background work during playback: lighter meters, a mixer that stops polling once ready, and an editor language worker that starts on first use.

## 0.3.4

- Stopping playback now lets delay and release tails ring out naturally instead of fading them in a fraction of a second; exports still start from silence.
- Dropdowns (Export, Share, Ask) and the Save As dialog close when you press outside them or hit Escape, and the mixer color palette does too.
- The /docs page now covers samples, the assistant and sharing, and the Hyperdrive setup is documented.

## 0.3.3

- Playback: batched editor highlights, a more tolerant audio buffer, earlier sample loading for live edits and a time-sliced pre-scan reduce glitches and start delay.
- Faster shared workspaces: Hyperdrive connection pooling, Smart Placement and parallel Liveblocks authorization lookups.
- The workbench loads the assistant and live collaboration code on demand, cutting its main script from 710 kB to 170 kB.

## 0.3.1

- Workspace invitations now use a responsive JamScript email template with a plain-text fallback.
- Desktop releases publish automatically after a version bump passes CI, website deployment checks, and all platform builds.
- Added `desktop:version` to keep desktop version files consistent and preview upcoming version changes.
