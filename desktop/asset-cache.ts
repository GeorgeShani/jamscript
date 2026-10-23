import { downloadSample, isSampleManifest, MANIFEST_FRESH_MS } from "../src/engine/sample-download";

const DATABASE = "jamscript-desktop-audio";
const STORE = "assets";
const METADATA = "metadata";
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(["raw.githubusercontent.com", "cdn.jsdelivr.net", "strudel.cc"]);

type CachedAsset = {
  url: string;
  bytes: ArrayBuffer;
  contentType: string;
  savedAt: number;
};

let databasePromise: Promise<IDBDatabase> | null = null;
const pending = new Map<string, Promise<CachedAsset>>();
const waiting: (() => void)[] = [];
let active = 0;

async function queued<T>(task: () => Promise<T>): Promise<T> {
  if (active >= 8) {
    if (waiting.length >= 32)
      throw new Error("Sample download queue is full. Try fewer samples at once.");
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else active += 1;
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}

export function canProxyAssetUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ALLOWED_HOSTS.has(url.hostname) &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443")
    );
  } catch {
    return false;
  }
}

function database() {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "url" });
        const metadata = db.createObjectStore(METADATA, { keyPath: "url" });
        // Preserve previously downloaded audio during the one-time cache migration.
        const cursor = request.transaction!.objectStore(STORE).openCursor();
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          const asset = entry.value as CachedAsset;
          metadata.put({ url: asset.url, savedAt: asset.savedAt, size: asset.bytes.byteLength });
          entry.continue();
        };
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          databasePromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error("Audio cache unavailable"));
      request.onblocked = () => reject(new Error("Audio cache is open in another window"));
    }).catch((cause: unknown) => {
      databasePromise = null;
      throw cause;
    });
  }
  return databasePromise;
}

async function read(url: string): Promise<CachedAsset | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(url);
    request.onsuccess = () => resolve((request.result as CachedAsset | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read audio cache"));
  });
}

async function write(asset: CachedAsset) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE, METADATA], "readwrite");
    const store = transaction.objectStore(STORE);
    store.put(asset);
    const metadata = transaction.objectStore(METADATA);
    metadata.put({ url: asset.url, savedAt: asset.savedAt, size: asset.bytes.byteLength });
    // Eviction must not clone up to 128 MB of audio onto the UI thread per download.
    const all = metadata.getAll();
    all.onsuccess = () => {
      const entries = (all.result as { url: string; size: number; savedAt: number }[]).sort(
        (a, b) => b.savedAt - a.savedAt,
      );
      let bytes = 0;
      for (const entry of entries) {
        bytes += entry.size;
        if (bytes > MAX_CACHE_BYTES) {
          store.delete(entry.url);
          metadata.delete(entry.url);
        }
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save audio"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Audio cache write aborted"));
  });
}

export async function loadDesktopAsset(url: string): Promise<CachedAsset> {
  if (!canProxyAssetUrl(url)) throw new Error("Sample host is not approved for desktop caching");
  // A cached sample should not wait behind slow downloads in the queue. Bank manifests
  // still go through the queue so their freshness rule applies.
  if (!isSampleManifest(url) && !pending.has(url)) {
    const hit = await read(url).catch(() => null);
    if (hit) return hit;
  }
  let load = pending.get(url);
  if (!load) {
    load = queued(() => loadAsset(url)).finally(() => pending.delete(url));
    pending.set(url, load);
  }
  const asset = await load;
  // Each bridge response transfers ownership; sharing one ArrayBuffer detaches it.
  return { ...asset, bytes: asset.bytes.slice(0) };
}

async function loadAsset(url: string): Promise<CachedAsset> {
  const cached = await read(url).catch(() => null);
  if (cached && (!isSampleManifest(url) || Date.now() - cached.savedAt < MANIFEST_FRESH_MS))
    return cached;
  try {
    const response = await downloadSample(
      new Request(url, {
        credentials: "omit",
        redirect: "error",
        cache: isSampleManifest(url) ? "no-cache" : "default",
      }),
      fetch,
      MAX_ASSET_BYTES,
    );
    const bytes = await response.arrayBuffer();
    const asset = {
      url,
      bytes,
      contentType: response.headers.get("Content-Type") ?? "application/octet-stream",
      savedAt: Date.now(),
    };
    try {
      await write(asset);
    } catch {
      // A storage failure should not turn a successful network load into silence.
    }
    return asset;
  } catch (cause) {
    if (cached) return cached;
    throw cause;
  }
}
