export const OTHER_SOUNDS = "Other sounds";

/** Drum-machine sounds are registered as `Bank_sound`; everything else is a plain name. */
export function sampleBank(name: string) {
  const split = name.lastIndexOf("_");
  return split > 0 ? name.slice(0, split) : OTHER_SOUNDS;
}
