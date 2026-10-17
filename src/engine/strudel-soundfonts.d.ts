declare module "@strudel/soundfonts" {
  export function getFontBufferSource(
    name: string,
    value: Record<string, unknown>,
    context: AudioContext,
  ): Promise<AudioBufferSourceNode>;
}

declare module "@strudel/soundfonts/gm.mjs" {
  const gm: Record<string, string[]>;
  export default gm;
}
