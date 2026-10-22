# Changelog

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
