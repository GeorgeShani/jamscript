/** Keep changing bank manifests fresh without fetching them on every live edit. */
export const MANIFEST_FRESH_MS = 60_000;
export const isSampleManifest = (url: string) => /\.json(?:$|[?#])/i.test(url);

class SampleRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function readBody(response: Response, maxBytes: number) {
  if (Number(response.headers.get("Content-Length")) > maxBytes) {
    void response.body?.cancel().catch(() => {});
    throw new SampleRequestError("Sample exceeds the download size limit", false);
  }
  const reader = response.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new SampleRequestError("Sample exceeds the download size limit", false);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

/** A bounded retry covers the body too, before Strudel stores its decode promise. */
export async function downloadSample(
  request: Request,
  fetcher: (input: Request, init?: RequestInit) => Promise<Response>,
  maxBytes = 64 * 1024 * 1024,
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    request.signal.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(request.signal.reason);
    request.signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetcher(request, { signal: controller.signal });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new SampleRequestError(
          `Sample request returned HTTP ${response.status}`,
          response.status === 408 || response.status === 429 || response.status >= 500,
        );
      }
      const bytes = await readBody(response, maxBytes);
      if (isSampleManifest(request.url)) {
        try {
          const manifest: unknown = JSON.parse(new TextDecoder().decode(bytes));
          if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
            throw new Error();
        } catch {
          throw new SampleRequestError("Sample manifest must contain a JSON object", false);
        }
      } else if (response.headers.get("Content-Type")?.includes("text/html")) {
        throw new SampleRequestError("Sample URL returned a web page instead of audio", false);
      }
      return new Response(bytes, { status: 200, headers: response.headers });
    } catch (cause) {
      request.signal.throwIfAborted();
      if (attempt >= 1 || (cause instanceof SampleRequestError && !cause.retryable)) {
        if (controller.signal.aborted)
          throw new SampleRequestError("Sample download timed out after 10 seconds", true);
        throw cause;
      }
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", abort);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
