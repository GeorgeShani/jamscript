// Initial demo song. After mount, CodeMirror's document is the source of truth.
// Controls are derived by src/engine/music-document.ts, never by fixed sample offsets.
export const SAMPLE_CODE = `setcps(0.6);
drums: s("bd ~ sd ~ bd bd sd ~");
hats: s("hh hh hh hh").gain(0.6);
bass: note("c2 ~ eb2 g1").s("sawtooth").lpf(1200).room(0.2);
perc: s("<[bd bd] ~ [sd <cp sd>]*2>");`;
