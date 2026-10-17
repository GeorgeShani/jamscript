// @strudel/web 1.3.0 bundles its own Web Audio registry and omits the
// soundfont registration done by the REPL. Register the same GM trigger in
// that registry; the soundfont decoder and GM map come from @strudel/soundfonts.
export async function registerBundledSoundfonts(strudel: typeof import("@strudel/web")) {
  const [{ getFontBufferSource }, { default: gm }] = await Promise.all([
    import("@strudel/soundfonts"),
    import("@strudel/soundfonts/gm.mjs"),
  ]);
  for (const [name, fonts] of Object.entries(gm)) {
    strudel.registerSound(
      name,
      async (time: number, value: Record<string, unknown>, onended: () => void) => {
        const [attack, decay, sustain, release] = strudel.getADSRValues([
          value["attack"],
          value["decay"],
          value["sustain"],
          value["release"],
        ]);
        const font = fonts[strudel.getSoundIndex(value["n"], fonts.length)];
        if (!font) throw new Error(`No soundfont variant for ${name}`);
        const context = strudel.getAudioContext() as AudioContext;
        const source = await getFontBufferSource(font, value, context);
        const holdEnd = time + Number(value["duration"]);
        const gain = context.createGain();
        source.connect(gain);
        strudel.getParamADSR(gain.gain, attack, decay, sustain, release, 0, 0.3, time, holdEnd, "linear");
        const vibrato = strudel.getVibratoOscillator(source.detune, value, time);
        strudel.getPitchEnvelope(source.detune, value, time, holdEnd);
        source.start(time);
        source.stop(holdEnd + release + 0.01);
        strudel.onceEnded(source, () => {
          strudel.releaseAudioNode(source);
          vibrato?.stop();
          onended();
        });
        return { node: gain, stop: () => {}, nodes: { source: [source], ...vibrato?.nodes } };
      },
      { type: "soundfont", prebake: true, fonts },
    );
  }
}
