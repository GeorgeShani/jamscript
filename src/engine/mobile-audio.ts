// Phones treat page audio as "ambient" by default. On iPhone that means the ring/silent
// switch mutes Web Audio entirely, so Play would appear to do nothing. Asking for a
// playback session (or, on older iOS, keeping a silent media element playing) makes the
// page behave like a music app. Both must start inside the user's Play gesture.

let silentLoop: HTMLAudioElement | null = null;

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** A short silent WAV, built in memory so no extra file is fetched. */
function silentWavUrl() {
  const samples = 4000; // half a second at 8 kHz, mono, 8-bit
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, samples, true);
  new Uint8Array(buffer, 44).fill(128);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

/** Call synchronously from the Play gesture, before any await. */
export function unlockMobileAudio() {
  if (typeof navigator === "undefined") return;
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      if (session.type !== "playback") session.type = "playback";
    } catch {
      // Older engines expose the object without allowing the change.
    }
    return;
  }
  if (!isAppleTouchDevice()) return;
  if (!silentLoop) {
    silentLoop = document.createElement("audio");
    silentLoop.src = silentWavUrl();
    silentLoop.loop = true;
    silentLoop.preload = "auto";
    // Keep the helper off AirPlay and the lock-screen media controls.
    silentLoop.setAttribute("x-webkit-airplay", "deny");
    silentLoop.disableRemotePlayback = true;
  }
  void silentLoop.play().catch(() => {
    // Without it, sound still plays when the silent switch is off.
  });
}

export function releaseMobileAudio() {
  silentLoop?.pause();
}
