import { afterEach, expect, it, vi } from "vitest";
import { downloadSample } from "@/engine/sample-download";

afterEach(() => vi.useRealTimers());

it("retries a temporary failure before handing bytes to the sampler", async () => {
  const network = vi
    .fn()
    .mockResolvedValueOnce(new Response("busy", { status: 503 }))
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
  const response = await downloadSample(new Request("https://example.com/kick.wav"), network);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(network).toHaveBeenCalledTimes(2);
});

it("does not decode or retry HTTP error pages and invalid manifests", async () => {
  const network = vi.fn(async () => new Response("not found", { status: 404 }));
  await expect(
    downloadSample(new Request("https://example.com/kick.wav"), network),
  ).rejects.toThrow("HTTP 404");
  expect(network).toHaveBeenCalledOnce();
  const html = vi.fn(
    async () => new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } }),
  );
  await expect(downloadSample(new Request("https://example.com/kick.wav"), html)).rejects.toThrow(
    "web page",
  );
  await expect(
    downloadSample(new Request("https://example.com/strudel.json"), html),
  ).rejects.toThrow("JSON object");
});

it("bounds stalled downloads to two attempts", async () => {
  vi.useFakeTimers();
  const network = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener(
          "abort",
          () => reject(new DOMException("Timed out", "AbortError")),
          { once: true },
        );
      }),
  );
  const outcome = downloadSample(new Request("https://example.com/kick.wav"), network).catch(
    (cause: unknown) => cause,
  );
  await vi.advanceTimersByTimeAsync(20_251);
  expect(await outcome).toHaveProperty("message", "Sample download timed out after 10 seconds");
  expect(network).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves caller cancellation without retrying", async () => {
  const controller = new AbortController();
  controller.abort();
  const network = vi.fn();
  await expect(
    downloadSample(
      new Request("https://example.com/kick.wav", { signal: controller.signal }),
      network,
    ),
  ).rejects.toThrow();
  expect(network).not.toHaveBeenCalled();
});

it("rejects oversized audio before it enters the cache", async () => {
  const network = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
  await expect(
    downloadSample(new Request("https://example.com/kick.wav"), network, 2),
  ).rejects.toThrow("size limit");
  expect(network).toHaveBeenCalledOnce();
});
