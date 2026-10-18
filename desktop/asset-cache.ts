const DATABASE = "jamscript-desktop-audio";
const STORE = "assets";
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
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "url" });
      request.onsuccess = () => resolve(request.result);
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
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    store.put(asset);
    const all = store.getAll();
    all.onsuccess = () => {
      const entries = (all.result as CachedAsset[]).sort((a, b) => b.savedAt - a.savedAt);
      let bytes = 0;
      for (const entry of entries) {
        bytes += entry.bytes.byteLength;
        if (bytes > MAX_CACHE_BYTES) store.delete(entry.url);
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save audio"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Audio cache write aborted"));
  });
}

export async function loadDesktopAsset(url: string): Promise<CachedAsset> {
  if (!canProxyAssetUrl(url)) throw new Error("Sample host is not approved for desktop caching");
  try {
    const response = await fetch(url, {
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Sample request returned ${response.status}`);
    const length = Number(response.headers.get("Content-Length") ?? 0);
    if (length > MAX_ASSET_BYTES) throw new Error("Sample exceeds the desktop cache limit");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_ASSET_BYTES)
      throw new Error("Sample exceeds the desktop cache limit");
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
    const cached = await read(url).catch(() => null);
    if (cached) return cached;
    throw cause;
  }
}
