import * as playback from "../src/engine/playback";
import { configureIsolatedAssetFetch } from "../src/engine/audio-cache";
import { canProxyAssetUrl } from "./asset-cache";

let nextAssetId = 0;
const assetPending = new Map<
  number,
  { resolve: (value: Response) => void; reject: (cause: Error) => void; timeout: number }
>();
configureIsolatedAssetFetch(async (url) => {
  if (!canProxyAssetUrl(url)) return null;
  if (assetPending.size >= 40) throw new Error("Sample download queue is full");
  const id = ++nextAssetId;
  return new Promise<Response>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      if (!assetPending.delete(id)) return;
      reject(new Error("Sample request timed out"));
    }, 120_000);
    assetPending.set(id, { resolve, reject, timeout });
    window.parent.postMessage({ channel: "jamscript-audio", type: "asset-request", id, url }, "*");
  });
});

let meterTimer: number | null = null;
function stopMeter() {
  if (meterTimer !== null) window.clearInterval(meterTimer);
  meterTimer = null;
}
function startMeter() {
  stopMeter();
  const output = playback.getOutputNode();
  if (!output) return;
  const analyser = output.context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.55;
  output.node.connect(analyser);
  const time = new Float32Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  meterTimer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(time);
    analyser.getByteFrequencyData(freq);
    let peak = 0;
    let sum = 0;
    for (const sample of time) {
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / time.length);
    const bands = new Array<number>(32).fill(0);
    for (let band = 0; band < bands.length; band += 1) {
      const start = Math.floor((band / bands.length) * freq.length);
      const end = Math.max(start + 1, Math.floor(((band + 1) / bands.length) * freq.length));
      let max = 0;
      for (let index = start; index < end; index += 1) max = Math.max(max, freq[index] ?? 0);
      bands[band] = max / 255;
    }
    send({
      type: "levels",
      peakDb: peak > 0 ? 20 * Math.log10(peak) : null,
      rmsDb: rms > 0 ? 20 * Math.log10(rms) : null,
      bands,
    });
  }, 50);
}

type Request = {
  channel: "jamscript-audio";
  id: number;
  command: "play" | "stop" | "mix";
  code?: string;
  levels?: Record<string, number>;
  solo?: string | null;
  master?: number;
  muted?: string[];
};
const send = (data: object) =>
  window.parent.postMessage({ channel: "jamscript-audio", ...data }, "*");
playback.onError((detail) => send({ type: "error", detail }));
playback.onAsset((detail) => send({ type: "asset", detail }));
playback.onHighlight((ranges) => send({ type: "highlight", ranges }));
window.addEventListener("message", async (event: MessageEvent<unknown>) => {
  if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
  const data = event.data as Partial<Request> & {
    type?: string;
    ok?: boolean;
    bytes?: ArrayBuffer;
    contentType?: string;
    detail?: string;
  };
  if (data.channel !== "jamscript-audio" || !Number.isSafeInteger(data.id)) return;
  const id = data.id as number;
  if (data.type === "asset-response") {
    const pending = assetPending.get(id);
    if (!pending) return;
    window.clearTimeout(pending.timeout);
    assetPending.delete(id);
    if (data.ok && data.bytes instanceof ArrayBuffer)
      pending.resolve(
        new Response(data.bytes, {
          status: 200,
          headers: { "Content-Type": data.contentType ?? "application/octet-stream" },
        }),
      );
    else pending.reject(new Error(data.detail ?? "Sample unavailable"));
    return;
  }
  try {
    if (data.command === "play" && typeof data.code === "string" && data.code.length <= 1_000_000) {
      const ok = await playback.play(data.code);
      if (ok) startMeter();
      send({ type: "result", id, ok });
    } else if (data.command === "stop") {
      stopMeter();
      await playback.stop();
      send({ type: "result", id, ok: true });
    } else if (
      data.command === "mix" &&
      data.levels &&
      typeof data.levels === "object" &&
      Object.values(data.levels).every(
        (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 2,
      ) &&
      (data.solo === null || typeof data.solo === "string") &&
      typeof data.master === "number" &&
      Number.isFinite(data.master) &&
      data.master >= 0 &&
      data.master <= 2 &&
      (data.muted === undefined ||
        (Array.isArray(data.muted) && data.muted.every((item) => typeof item === "string")))
    ) {
      playback.setMix(data.levels, data.solo, data.master, data.muted ?? []);
      send({ type: "result", id, ok: true });
    }
  } catch (cause) {
    send({ type: "error", detail: cause instanceof Error ? cause.message : String(cause) });
    send({ type: "result", id, ok: false });
  }
});
send({ type: "ready" });
