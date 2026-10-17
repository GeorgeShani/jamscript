import { getOutputNode, initPlayback, play, setMix, stop } from "./playback";

const loadedWorklets = new WeakSet<AudioContext>();

export interface Recording {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
}

function concat(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Capture the actual master Web Audio output while the current source plays. */
export async function recordMainFlow({
  code,
  cps,
  bars,
  levels,
  master,
  signal,
  onProgress,
}: {
  code: string;
  cps: number;
  bars: number;
  levels: Record<string, number>;
  master: number;
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
}): Promise<Recording> {
  if (!Number.isFinite(cps) || cps <= 0) throw new Error("Set a valid BPM before exporting.");
  if (![4, 8, 16].includes(bars)) throw new Error("Choose 4, 8, or 16 bars.");
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  await initPlayback();
  const output = getOutputNode();
  if (!output) throw new Error("Audio output is unavailable.");
  const { context, node } = output;
  if (context.state !== "running") await context.resume();
  if (context.state !== "running")
    throw new Error("Audio is suspended. Click Play once, then retry export.");
  if (!context.audioWorklet) throw new Error("This browser cannot record audio with AudioWorklet.");
  if (!loadedWorklets.has(context)) {
    await context.audioWorklet.addModule("/audio/jamscript-recorder.js");
    loadedWorklets.add(context);
  }
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");

  const recorder = new AudioWorkletNode(context, "jamscript-recorder", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const silent = context.createGain();
  silent.gain.value = 0;
  node.connect(recorder);
  recorder.connect(silent);
  silent.connect(context.destination);
  const left: Float32Array[] = [];
  const right: Float32Array[] = [];
  let finished!: () => void;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });
  recorder.port.onmessage = (event: MessageEvent) => {
    if (event.data?.done) finished();
    else if (event.data?.left && event.data?.right) {
      left.push(event.data.left);
      right.push(event.data.right);
    }
  };

  const durationMs = (bars / cps) * 1000;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let progress: ReturnType<typeof setInterval> | undefined;
  try {
    await stop();
    setMix(levels, null, master); // Export always captures the full mix, even if a track is soloed.
    if (!(await play(code))) throw new Error("Could not play the current document for export.");
    startedAt = performance.now();
    await new Promise<void>((resolve, reject) => {
      const cancel = () => reject(new DOMException("Export cancelled", "AbortError"));
      signal.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(() => {
        signal.removeEventListener("abort", cancel);
        resolve();
      }, durationMs);
      progress = setInterval(
        () => onProgress(Math.min(1, (performance.now() - startedAt) / durationMs)),
        150,
      );
      if (signal.aborted) cancel();
    });
    recorder.port.postMessage("stop");
    await done;
    onProgress(1);
    return { sampleRate: context.sampleRate, left: concat(left), right: concat(right) };
  } finally {
    if (timer) clearTimeout(timer);
    if (progress) clearInterval(progress);
    try {
      recorder.port.postMessage("stop");
    } catch {
      /* Already stopped. */
    }
    try {
      node.disconnect(recorder);
    } catch {
      /* Output was reset. */
    }
    recorder.disconnect();
    silent.disconnect();
    await stop();
  }
}

function sample(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  return Math.round(clamped < 0 ? clamped * 32768 : clamped * 32767);
}

export function encodeWav(recording: Recording): Blob {
  const frames = Math.min(recording.left.length, recording.right.length);
  const buffer = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(buffer);
  const ascii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  ascii(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, recording.sampleRate, true);
  view.setUint32(28, recording.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, frames * 4, true);
  for (let index = 0; index < frames; index++) {
    view.setInt16(44 + index * 4, sample(recording.left[index]!), true);
    view.setInt16(46 + index * 4, sample(recording.right[index]!), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function encodeMp3(recording: Recording, signal?: AbortSignal): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(2, recording.sampleRate, 192);
  const chunks: BlobPart[] = [];
  const length = Math.min(recording.left.length, recording.right.length);
  for (let offset = 0; offset < length; offset += 1152) {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    const count = Math.min(1152, length - offset);
    const left = new Int16Array(count);
    const right = new Int16Array(count);
    for (let index = 0; index < count; index++) {
      left[index] = sample(recording.left[offset + index]!);
      right[index] = sample(recording.right[offset + index]!);
    }
    const encoded = encoder.encodeBuffer(left, right);
    if (encoded.length) chunks.push(Uint8Array.from(encoded));
    if (offset % (1152 * 128) === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(Uint8Array.from(tail));
  return new Blob(chunks, { type: "audio/mpeg" });
}
