export interface RegisteredSample {
  name: string;
  count: number;
}
export interface SamplePreview {
  name: string;
  index: number;
  duration: number;
  peaks: number[];
  offset: number;
  startedAt: number;
}
type Runtime = {
  soundMap: { get(): Record<string, { data?: { type?: string; samples?: unknown } }> };
  getSound(name: string): { data?: { type?: string; samples?: unknown } } | undefined;
  getSampleBuffer(
    value: Record<string, unknown>,
    samples: unknown,
  ): Promise<{ buffer: AudioBuffer }>;
  getAudioContext(): AudioContext;
};
let generation = 0;
let voice: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
let volume = 0.7;
let decoding: Promise<unknown> = Promise.resolve();
export function stopSamplePreview() {
  generation++;
  if (voice) {
    voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
    voice = null;
  }
}
export function setSamplePreviewVolume(value: number) {
  if (!Number.isFinite(value)) return;
  volume = Math.min(1, Math.max(0, value));
  if (voice) voice.gain.gain.setTargetAtTime(volume, voice.gain.context.currentTime, 0.015);
}
export function registeredSamples(runtime: Runtime): RegisteredSample[] {
  return Object.entries(runtime.soundMap.get())
    .filter(
      ([name, sound]) =>
        name !== "_base" &&
        sound.data?.type === "sample" &&
        !!sound.data.samples &&
        typeof sound.data.samples === "object",
    )
    .slice(0, 4096)
    .map(([name, sound]) => ({
      name,
      count: Array.isArray(sound.data?.samples) ? sound.data.samples.length : 1,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export async function auditionRegisteredSample(
  runtime: Runtime,
  name: string,
  index = 0,
  offset = 0,
): Promise<SamplePreview> {
  stopSamplePreview();
  const current = generation;
  const sound = runtime.getSound(name)?.data;
  if (
    !sound ||
    sound.type !== "sample" ||
    !sound.samples ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= (Array.isArray(sound.samples) ? sound.samples.length : 1)
  )
    throw new Error("Choose an available registered sample");
  const pending = decoding
    .catch(() => {})
    .then(() => {
      if (current !== generation) throw new DOMException("Preview cancelled", "AbortError");
      return runtime.getSampleBuffer({ s: name, n: index }, sound.samples);
    });
  decoding = pending;
  const { buffer } = await pending;
  if (current !== generation) throw new DOMException("Preview cancelled", "AbortError");
  const context = runtime.getAudioContext();
  await context.resume();
  if (current !== generation) throw new DOMException("Preview cancelled", "AbortError");
  const peaks = new Array<number>(256).fill(0);
  const data = buffer.getChannelData(0);
  const width = Math.max(1, Math.ceil(data.length / peaks.length));
  for (let point = 0; point < peaks.length; point++) {
    const start = point * width,
      end = Math.min(data.length, start + width);
    const step = Math.max(1, Math.ceil((end - start) / 256));
    for (let i = start; i < end; i += step)
      peaks[point] = Math.max(peaks[point]!, Math.abs(data[i] ?? 0));
  }
  const source = context.createBufferSource(),
    gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(context.destination);
  const selected = { source, gain };
  voice = selected;
  source.addEventListener(
    "ended",
    () => {
      source.disconnect();
      gain.disconnect();
      if (voice === selected) voice = null;
    },
    { once: true },
  );
  const at = Math.max(0, Math.min(Number.isFinite(offset) ? offset : 0, buffer.duration));
  source.start(0, at);
  return { name, index, duration: buffer.duration, peaks, offset: at, startedAt: Date.now() };
}
