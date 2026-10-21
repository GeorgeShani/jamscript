# audiocn integration into JamScript

Research date: 2026-10-21. Status: core delivery slices implemented; optional settings and performance visual modes remain deferred as described below.

## Implementation status

- [x] Mixer, Channel Strip, Fader and Channel Toggle now drive existing mix state. Faders show/edit dB, retain unity as the maximum, and map exact silence to persisted linear zero.
- [x] The code editor now mounts the same audiocn Knob and Pan Control components as the Inspector, retaining 28px inline knobs, checked source patches, gestures, undo and read-only guards.
- [x] Literal `.pan(...)` lenses convert between Strudel's 0–1 and the control's −1–1 range. Computed arguments stay code-only.
- [x] Output selects one of Spectrum, frequency Bars or the actual time-domain Waveform. Desktop transmits bounded 256-sample frames and reports its combined meter as mono rather than duplicating it as stereo. Removed analyser connections are disconnected.
- [x] A lazy-loaded Samples tab lists real registered banks, filters sounds, selects variants and auditions Sound Pads through Strudel's existing context/cache without evaluating or replacing the playing song. One decoded preview is active at a time; decoding is serialized and superseded work is discarded.
- [x] The selected clip has a real Waveform, seeking, play/stop and preview volume. Pad shortcuts are scoped to grid focus. Preview Stop and the main Stop cancel pending/active previews.
- [x] Explicit replacement re-parses the current selected single sound with Lezer and enters CodeMirror's undo/live-control path. Pattern strings, multi-argument calls, inherited banks and read-only documents are rejected.
- [x] Upstream components are pinned to audiocn/ui revision `521c03f636a4e2cf14a25b79c5838223a3fd6ae8`; imports/types are adapted to local helpers and strict TypeScript. MIT notices cover the added components.
- [ ] Optional slice 4: device switching, LCD and electric visualizers. No input permissions or simulated device switching were introduced.
- [ ] Future telemetry/clip scope: per-orbit meters, independent desktop stereo, a rendered-audio queue/Track List and recording. Source Takes remain source snapshots.

Verification covers checked pan edits/undo, exact dB gain callbacks, sample cancellation, safe insertion, bounded desktop waveform/RPC data and browser interaction. Browser and desktop web bundles are built; packaged OS/hardware behavior still needs device testing. Component catalog decisions marked “Later” below remain intentionally deferred.

## Recommended direction

Use audiocn as the IDE's music-control and monitoring layer. Keep CodeMirror central, use the right inspector for the selected track, and offer a resizable mixer/output area below. Add sample auditioning to the Library. Expose relevant components progressively instead of displaying every meter, waveform, and control simultaneously.

The official [component catalog](https://www.audiocn.dev/docs/components) lists 24 component families. Its [custom-engine guide](https://www.audiocn.dev/docs/concepts/custom-engine) explicitly supports externally supplied frames and control callbacks. JamScript can therefore keep Strudel and its desktop sandbox as the audio engine.

## What already works in this repository

- [TrackInspector](src/workbench/TrackInspector.tsx) uses Knob and Parameter Slider for checked source edits.
- [OutputPanel](src/workbench/OutputPanel.tsx) uses Level Meter and Spectrum for real master output. Level Meter composes the existing dB Scale, dB Readout, and Clip Indicator.
- [MixerPanel](src/workbench/MixerPanel.tsx) has functioning runtime master/track levels, selection, mute, solo, rename, and color. Its current sliders show percentages; audiocn Fader/Channel Toggle/Channel Strip can improve this surface.
- [FrameSource types](src/lib/types.ts), [frame emitters](src/lib/frame-source.ts), and [browser analyser](src/hooks/use-audio-analyser.ts) already provide a compatible data path. Browser visual frames include time-domain samples.
- [Desktop telemetry](desktop/sandbox.ts) currently publishes one combined peak/RMS reading and 32 frequency bands. [The receiving adapter](desktop/sandboxed-playback.ts) duplicates the combined reading into two meter entries; these are not independently measured stereo channels. It does not transmit raw waveforms or per-track levels.
- [Takes](src/features/takes/take-store.ts) contain source snapshots, not recorded audio clips.

## Component placement: all 24 families

The capabilities in this inventory come from the [official catalog](https://www.audiocn.dev/docs/components); the locations and priorities are JamScript design proposals.

| Component               | Place in JamScript                                      | Delivery decision                                                               |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Level Meter             | Master output; later, supported track strips            | Already used; add real per-orbit metering before track meters                   |
| dB Scale                | Meter/fader scales                                      | Already present through Level Meter; reuse                                      |
| dB Readout              | Master and track measurements                           | Already present; distinguish measured dBFS from fader gain dB                   |
| Clip Indicator          | Master/track overload warning with reset                | Already present through Level Meter; expose reset/accessibility clearly         |
| Bar Visualizer          | Optional Output view                                    | Add as an alternative to Spectrum, using actual bands                           |
| Electric Bar Visualizer | Optional performance visual mode                        | Later; mutually exclusive with other expensive views                            |
| Electric Waveform       | Optional performance visual mode                        | Later; preserve reduced-motion support and rendering budget                     |
| Smooth Waveform         | Default optional waveform/scope Output view             | Browser data is available; extend desktop telemetry for true scope mode         |
| Live Waveform           | Scrolling live Output view                              | Add only after choosing its actual frame contract and desktop transport         |
| Waveform                | Selected sample or rendered-audio preview               | Requires decoded clip peaks/duration; not a song timeline                       |
| Spectrum                | Frequency inspection in Output                          | Already used; retain as a selectable view                                       |
| Fader                   | Master and safely separable track levels                | First implementation slice; adapt dB to existing linear runtime gain            |
| Parameter Slider        | Filter, room, timing and other supported literal values | Already used; extend only when the checked source target is safe                |
| Knob                    | Inline lenses and selected-track controls               | Already used; preserve compact sizes and modulation locks                       |
| LCD Display             | Optional tempo/CPS/status readout                       | Later, if it fits the toolbar; show real transport values, no invented duration |
| Pan Control             | Selected-track source inspector                         | Add a checked literal `.pan(...)` lens first; convert units correctly           |
| Channel Toggle          | Existing mute/solo actions                              | First slice; reuse current state, omit monitor until an input path exists       |
| Volume Control          | Master or sample-preview volume                         | Alternative compact layout; avoid duplicating a visible master Fader            |
| Audio Device Select     | Audio settings                                          | Capability-gated; device enumeration alone does not switch the output           |
| Channel Strip           | Mixer track rows and master                             | First slice; preserve rename, color, selection, permission and routing rules    |
| Mixer                   | Container for those strips                              | First slice; retain current workspace mix state as the authority                |
| Audio Player            | Sample/rendered-export auditioning                      | Later; use actual audio artifacts, not source snapshots                         |
| Track List              | Queue of samples or rendered audio                      | Later; keep file tabs and source Takes conceptually distinct                    |
| Sound Pad               | Sample Library audition controls                        | Second slice; trigger through JamScript's audio adapter                         |

For details beyond the catalog: [Fader](https://www.audiocn.dev/docs/components/fader), [Pan Control](https://www.audiocn.dev/docs/components/pan-control), [Channel Strip](https://www.audiocn.dev/docs/components/channel-strip), [Sound Pad](https://www.audiocn.dev/docs/components/sound-pad), [Waveform](https://www.audiocn.dev/docs/components/waveform), [Smooth Waveform](https://www.audiocn.dev/docs/components/smooth-waveform), and [Audio Device Select](https://www.audiocn.dev/docs/components/audio-device-select).

## Integration contracts

### Keep source controls and runtime mixing distinct

1. A source knob, slider, or future pan control writes through `dispatchLensEdit` and the checked patcher. Derive its range from Lezer syntax. Do not replace expressions such as `.pan(sine)` or `.gain(perlin.range(...))` with constants.
2. Source edits from controls update playing music; typed code remains staged until Ctrl/Cmd+Enter. Preserve existing undo and per-document editor state.
3. Mixer mute, solo and levels retain their existing runtime/workspace state semantics. Replacing their UI must not silently rewrite source or introduce a second competing mixer store.
4. Preserve post-stack effects and routing. Coastline and other non-separable programs keep master monitoring and source controls; do not invent isolated channel strips or change orbits to make a mixer look populated. See [product rules](PRODUCT.md) and [prepareMix](src/engine/mix-source.ts).

### Translate values at the adapter boundary

- audiocn [Fader values are dB](https://www.audiocn.dev/docs/components/fader). Use the existing [decibel helpers](src/lib/decibels.ts): linear gain is `10 ** (dB / 20)` and zero gain corresponds to `-Infinity`. Preserve the current allowed gain range; do not add amplification accidentally.
- Preserve exact silence. Never serialize `Infinity` or `-Infinity` as mixer configuration; keep persisted/native gain linear, and retain the existing telemetry convention of `null` for silence across message boundaries.
- audiocn [Pan Control uses -1 to 1](https://www.audiocn.dev/docs/components/pan-control). The installed Strudel engine maps its pan with `2 * pan - 1` in `node_modules/superdough/superdough.mjs`; therefore source `.pan` is 0 to 1. UI-to-source is `(uiPan + 1) / 2`, and source-to-UI is `2 * sourcePan - 1`.
- Use continuous change callbacks for live sound. Use commit callbacks for slower persistence where appropriate, following the [custom-engine guide](https://www.audiocn.dev/docs/concepts/custom-engine). Preserve the existing source-edit transaction lifecycle.

### Use real data, with one audio engine

- Reuse the existing browser analyser and desktop `FrameSource` adapters. Do not create an AudioContext per meter or invoke demo-signal hooks in production.
- Add per-orbit analysers only for real independently mixable tracks. Measure at a defined point after track mute/solo/gain and document whether a meter includes effects. Clean up connections on document switches and Stop.
- Desktop waveform/scope support requires bounded time-domain frames in the sandbox bridge. Independently measured stereo requires independent L/R analysis. A combined peak copied twice must not be presented as true stereo metering.
- Use `useFrameSource`, level/clip hooks, visibility and reduced-motion helpers where their contracts match the locally copied components. Keep React state updates separate from high-rate painting.
- Sound Pad [emits triggers without playing audio itself](https://www.audiocn.dev/docs/components/sound-pad). Add an audition operation to the current engine/desktop bridge, using the same asset loader and a controllable preview bus. Audition must not replace the playing song or change source. Insert a sample into source only through an explicit safe edit.
- Audio Player, Track List, `useAudioPlayer` and `useWaveformData` belong to real clip previews. Current source Takes must not gain fake audio seeking controls. Adopt `useSound` only if it can share the existing context and honor preview stop/mute semantics.
- The [device selector accepts externally supplied device state](https://www.audiocn.dev/docs/components/audio-device-select). Implement actual sink selection and fallback reporting before showing it as working. Verify browser/WebView support at runtime; request permissions only in response to the relevant action.
- Microphone/system-audio hooks and their setup blocks are future recording/input features. They are not prerequisites for composing Strudel music, and should not prompt for capture permissions on startup.

## Delivery slices and acceptance criteria

### 1. Mixer upgrade

- Copy and adapt Mixer, Channel Strip, Fader and Channel Toggle, with their actual dependencies.
- Replace the existing percentage ranges while preserving track IDs, mix persistence, mute/solo, selection, color and rename.
- Keep source gain distinct from runtime mix level. Maintain current maximum gain, keyboard operations, exact mute and unity gain.
- Keep master metering real; omit individual meters until per-orbit telemetry is implemented.
- Verify ordinary labeled songs and Coastline, browser and desktop, tab switches, quick restarts, and narrow panels. Changing controls must affect the intended audio path immediately.

### 2. Source pan and output views

- Add safe numeric pan lenses with undo, range conversion, source-range validation and live evaluation. Computed/ambiguous pan remains code-only.
- Add a single Output selector for Spectrum, Bars, and Smooth Waveform. Expand desktop telemetry for scope mode before claiming parity.
- Verify pan left/center/right round trips, source undo, dynamic-expression locks, silence/clipping, analyser cleanup, hidden tabs, reduced motion and sustained playback performance.

### 3. Sample exploration

- Show samples actually registered by the song or selected bank, with loading/error state and bounded decoding.
- Sound Pads audition through the existing engine; Waveform/Audio Player preview the selected real clip. Add Track List only when an audio queue exists.
- Scope pad hotkeys to the sample surface: typing into CodeMirror, dialogs or chat must never fire sounds. Hold/toggle/one-shot behavior and Stop must release preview voices correctly.
- Explicit sample insertion must use an unambiguous source edit with undo. Do not add browser filesystem access.

### 4. Optional settings and visual modes

- Add a capability-aware Audio Device Select with working native/browser output switching.
- Consider an LCD readout or Quick Audio Popover without duplicating transport controls.
- Offer electric visualizers as opt-in performance views after profiling. Do not render every visualizer at once or use decorative signal activity when audio is silent.
- Treat Microphone Setup, System Audio Settings/Mixer, Soundboard and Music Player blocks as composition references, not wholesale replacements for the IDE or a reason to add unrelated capture features.

## Installation and design checks

- Inspect registry source, dependency versions and upstream license notices before adding a component. Preserve existing audiocn adaptations and local helpers; do not bulk-install over the current files.
- Preserve JamScript's Schibsted Grotesk/Martian Mono fonts, amber accents, clear floating borders, 14px code, 28px inline knobs, 24px rhythm cells and 48px desktop toolbar. Retain the 900px transport breakpoint and local scrolling. See [DESIGN.md](DESIGN.md).
- New controls need accessible names, keyboard/focus behavior, disabled/locked states and visible error recovery. Per-channel metadata and permission checks must reflect actual services.
- After each slice: run relevant unit/integration tests, TypeScript, lint, web/desktop builds, then verify real audio and representative wide/narrow layouts. Components are copied locally; no new runtime package was installed for this integration.
