import api from "./strudel-api.generated.json";

export const docs: Record<string, { signature: string; detail: string }> = {
  ...api.documentation,
  stack: { signature: "stack(...patterns)", detail: "Play patterns together in one cycle." },
  samples: { signature: "samples(source)", detail: "Load a named sample bank or sample manifest." },
  chord: { signature: "chord(symbols)", detail: "Create a pattern of chord symbols." },
  dict: { signature: ".dict(name)", detail: "Interpret symbols with the selected dictionary." },
  voicing: { signature: ".voicing()", detail: "Turn chord symbols into playable note voicings." },
  struct: { signature: ".struct(pattern)", detail: "Apply a rhythmic structure to a pattern." },
  bank: { signature: ".bank(name)", detail: "Select a sample bank." },
  mask: { signature: ".mask(pattern)", detail: "Silence events where the mask is off." },
  lpf: { signature: ".lpf(hertz)", detail: "Set the low-pass filter cutoff in hertz." },
  s: { signature: "s(sound)", detail: "Select a sample or instrument." },
  sound: { signature: "sound(name)", detail: "Select a sample or instrument." },
  note: { signature: "note(pitch)", detail: "Set note pitches using numbers or note names." },
  n: { signature: "n(index)", detail: "Select a sample or scale degree by index." },
  gain: { signature: ".gain(amount)", detail: "Set signal gain. Large values can clip." },
  pan: { signature: ".pan(position)", detail: "Move sound between left and right." },
  room: { signature: ".room(amount)", detail: "Add room reverb." },
  delay: { signature: ".delay(amount)", detail: "Add delay." },
  fast: { signature: ".fast(factor)", detail: "Speed up a pattern by a factor." },
  slow: { signature: ".slow(factor)", detail: "Slow down a pattern by a factor." },
  setcps: {
    signature: "setcps(cyclesPerSecond)",
    detail: "Set the global playback rate in cycles per second.",
  },
  setcpm: {
    signature: "setcpm(cyclesPerMinute)",
    detail: "Set the global playback rate in cycles per minute.",
  },
};

/** A bounded, pinned documentation lookup for server-side assistant context. */
export function strudelDocumentation(name: string) {
  return docs[name] ?? null;
}
