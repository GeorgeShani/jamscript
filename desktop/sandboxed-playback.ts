import type { PlaybackRange } from "../src/components/jam/playback-highlights";
import { dbToLevel } from "../src/lib/decibels";
import { createFrameEmitter } from "../src/lib/frame-source";
import { appendHistory } from "../src/lib/history";
import { loadDesktopAsset } from "./asset-cache";
import type { MeterFrame, VisualFrame } from "../src/lib/types";
import type { RegisteredSample, SamplePreview } from "../src/engine/sample-preview";

let frame: HTMLIFrameElement | null = null;
let ready: Promise<void> | null = null;
let nextId = 0;
let errorCallback: ((message: string) => void) | null = null;
let highlightCallback: ((ranges: PlaybackRange[]) => void) | null = null;
let inFlightAssets = 0;
const pending = new Map<number, (ok: boolean) => void>();
const samplePending = new Map<
  number,
  { resolve(value: unknown): void; reject(error: Error): void }
>();
const meter = createFrameEmitter<MeterFrame>();
const visualFrame: VisualFrame = {
  bands: new Float32Array(32),
  history: new Float32Array(60),
  historyStart: 0,
  historyLength: 0,
  peakDb: Number.NEGATIVE_INFINITY,
};
const visual = createFrameEmitter<VisualFrame>();

export function outputFrames() {
  return { meter, visual };
}

function pushLevels(peakDb: number, rmsDb: number, bands: number[], timeDomain: number[] = []) {
  for (let index = 0; index < visualFrame.bands.length; index += 1)
    visualFrame.bands[index] = bands[index] ?? 0;
  visualFrame.peakDb = peakDb;
  appendHistory(visualFrame, dbToLevel(peakDb), performance.now(), 50);
  visualFrame.timeDomain = new Float32Array(timeDomain);
  const channels = [{ peakDb, rmsDb }];
  meter.emit({ channels });
  visual.emit({
    ...visualFrame,
    bands: visualFrame.bands.slice(),
    history: visualFrame.history.slice(),
  });
}

function ensureFrame() {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    // An opaque origin keeps executable source away from the workbench and native IPC.
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.allow = "autoplay";
    iframe.title = "JamScript isolated audio runtime";
    iframe.hidden = true;
    iframe.src = new URL("/sandbox.html", window.location.href).href;
    frame = iframe;
    const timeout = window.setTimeout(() => {
      iframe.remove();
      frame = null;
      ready = null;
      reject(new Error("Audio sandbox did not start"));
    }, 15_000);
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframe.contentWindow || !event.data || typeof event.data !== "object")
        return;
      const data = event.data as {
        channel?: string;
        type?: string;
        id?: number;
        ok?: boolean;
        detail?: string;
        ranges?: PlaybackRange[];
        url?: string;
      };
      if (data.channel !== "jamscript-audio") return;
      if (data.type === "asset-request" && Number.isSafeInteger(data.id)) {
        const id = data.id as number;
        // The loader queues eight active plus 32 waiting downloads. Bound bridge
        // callers too, including duplicate URLs sent by executable song code.
        if (typeof data.url !== "string" || inFlightAssets >= 40) {
          iframe.contentWindow?.postMessage(
            {
              channel: "jamscript-audio",
              type: "asset-response",
              id,
              ok: false,
              detail: "Invalid sample request or download queue full",
            },
            "*",
          );
          return;
        }
        inFlightAssets += 1;
        void loadDesktopAsset(data.url)
          .then((asset) => {
            iframe.contentWindow?.postMessage(
              {
                channel: "jamscript-audio",
                type: "asset-response",
                id,
                ok: true,
                bytes: asset.bytes,
                contentType: asset.contentType,
              },
              "*",
              [asset.bytes],
            );
          })
          .catch((cause: unknown) => {
            iframe.contentWindow?.postMessage(
              {
                channel: "jamscript-audio",
                type: "asset-response",
                id,
                ok: false,
                detail: cause instanceof Error ? cause.message : "Sample unavailable",
              },
              "*",
            );
          })
          .finally(() => {
            inFlightAssets -= 1;
          });
        return;
      }
      if (
        data.type === "levels" &&
        Array.isArray((data as { bands?: unknown }).bands) &&
        (data as { bands: unknown[] }).bands.length === 32 &&
        (data as { bands: unknown[] }).bands.every(
          (band) => typeof band === "number" && band >= 0 && band <= 1,
        )
      ) {
        const levels = data as {
          peakDb?: unknown;
          rmsDb?: unknown;
          bands: number[];
          timeDomain?: unknown;
        };
        const peak = typeof levels.peakDb === "number" ? levels.peakDb : Number.NEGATIVE_INFINITY;
        const rms = typeof levels.rmsDb === "number" ? levels.rmsDb : peak;
        const samples =
          Array.isArray(levels.timeDomain) &&
          levels.timeDomain.length === 256 &&
          levels.timeDomain.every(
            (value: unknown) => typeof value === "number" && Number.isFinite(value),
          )
            ? (levels.timeDomain as number[])
            : [];
        pushLevels(peak, rms, levels.bands, samples);
        return;
      }
      if (data.type === "ready") {
        window.clearTimeout(timeout);
        resolve();
      } else if (
        (data.type === "error" || data.type === "asset") &&
        typeof data.detail === "string"
      )
        errorCallback?.(data.detail);
      else if (
        data.type === "highlight" &&
        Array.isArray(data.ranges) &&
        data.ranges.every(
          (r) =>
            Number.isSafeInteger(r.from) &&
            Number.isSafeInteger(r.to) &&
            r.from >= 0 &&
            r.to >= r.from,
        )
      )
        highlightCallback?.(data.ranges);
      else if (data.type === "sample-result" && typeof data.id === "number") {
        const response = data as unknown as { id: number; error?: string; value?: unknown };
        const waiting = samplePending.get(response.id);
        samplePending.delete(response.id);
        if (response.error) waiting?.reject(new Error(response.error));
        else waiting?.resolve(response.value);
      } else if (data.type === "result" && typeof data.id === "number") {
        pending.get(data.id)?.(data.ok === true);
        pending.delete(data.id);
      }
    };
    window.addEventListener("message", onMessage);
    iframe.addEventListener("error", () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      frame = null;
      ready = null;
      reject(new Error("Audio sandbox did not start"));
    });
    document.body.append(iframe);
  });
  return ready;
}

async function request(command: "play" | "stop" | "mix" | "warm", fields: object = {}) {
  await ensureFrame();
  const id = ++nextId;
  return new Promise<boolean>((resolve, reject) => {
    pending.set(id, resolve);
    frame?.contentWindow?.postMessage({ channel: "jamscript-audio", id, command, ...fields }, "*");
    window.setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error("Audio sandbox did not respond"));
    }, 60_000);
  });
}

export function onError(callback: ((message: string) => void) | null) {
  errorCallback = callback;
}
export function onHighlight(callback: ((ranges: PlaybackRange[]) => void) | null) {
  highlightCallback = callback;
}
export function setMix(
  levels: Record<string, number>,
  solo: string | null,
  master: number,
  muted: readonly string[] = [],
) {
  if (frame)
    void request("mix", { levels, solo, master, muted: [...muted] }).catch((error: unknown) =>
      errorCallback?.(String(error)),
    );
}
export async function play(code: string) {
  return request("play", { code });
}
export async function stop() {
  window.dispatchEvent(new Event("jamscript:preview-stopped"));
  if (frame) await request("stop");
  pushLevels(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    new Array(32).fill(0),
    new Array(256).fill(0),
  );
}
export function getOutputNode(): null {
  return null;
}
export function initPlayback(): Promise<never> {
  return Promise.reject(new Error("Desktop audio runs in an isolated frame"));
}

export async function warmPlayback(): Promise<void> {
  if (!(await request("warm"))) throw new Error("Audio sandbox preparation failed");
}

async function sampleRequest<T>(command: string, fields: object = {}): Promise<T> {
  await ensureFrame();
  if (samplePending.size >= 32) throw new Error("Sample preview queue is full");
  const id = ++nextId;
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      samplePending.delete(id);
      reject(new Error("Sample preview timed out"));
    }, 60_000);
    samplePending.set(id, {
      resolve: (value) => {
        window.clearTimeout(timer);
        resolve(value as T);
      },
      reject: (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    });
    frame?.contentWindow?.postMessage({ channel: "jamscript-audio", id, command, ...fields }, "*");
  });
}
export async function listRegisteredSamples(): Promise<RegisteredSample[]> {
  const value = await sampleRequest<RegisteredSample[]>("list-samples");
  if (
    !Array.isArray(value) ||
    value.length > 4096 ||
    value.some(
      (item) =>
        !item ||
        typeof item.name !== "string" ||
        item.name.length > 200 ||
        !Number.isInteger(item.count) ||
        item.count < 0,
    )
  )
    throw new Error("Invalid sample list from audio sandbox");
  return value;
}
export async function auditionSample(
  sampleName: string,
  index = 0,
  offset = 0,
): Promise<SamplePreview> {
  const value = await sampleRequest<SamplePreview>("audition-sample", {
    sampleName,
    index,
    offset,
  });
  if (
    !value ||
    value.name !== sampleName ||
    value.index !== index ||
    !Number.isFinite(value.duration) ||
    value.duration < 0 ||
    !Number.isFinite(value.offset) ||
    !Number.isFinite(value.startedAt) ||
    !Array.isArray(value.peaks) ||
    value.peaks.length !== 256 ||
    value.peaks.some((peak) => !Number.isFinite(peak) || peak < 0)
  )
    throw new Error("Invalid sample preview from audio sandbox");
  return value;
}
export const stopSamplePreview = () => {
  window.dispatchEvent(new Event("jamscript:preview-stopped"));
  if (frame) void sampleRequest("stop-preview").catch(() => {});
};
export const setSamplePreviewVolume = (volume: number) => {
  if (frame) void sampleRequest("preview-volume", { volume }).catch(() => {});
};
