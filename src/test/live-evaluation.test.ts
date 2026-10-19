import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveEvaluation } from "@/workbench/live-evaluation";

afterEach(() => vi.useRealTimers());

describe("live control evaluation", () => {
  it("updates throughout a continuous drag rather than waiting for it to finish", async () => {
    vi.useFakeTimers();
    let source = "";
    const heard: string[] = [];
    const updates = createLiveEvaluation(async () => {
      heard.push(source);
    });
    for (let step = 0; step < 20; step++) {
      source = `gain(${step})`;
      updates.request();
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(heard.length).toBeGreaterThanOrEqual(4);
    expect(heard.at(-1)).toBe("gain(19)");
    updates.cancel();
  });

  it("serializes slow evaluations, keeps the latest value, and cancels queued work on Stop", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const evaluate = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const updates = createLiveEvaluation(evaluate);
    updates.request();
    await vi.advanceTimersByTimeAsync(40);
    updates.request();
    updates.request();
    await vi.advanceTimersByTimeAsync(160);
    expect(evaluate).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(40);
    expect(evaluate).toHaveBeenCalledTimes(2);
    updates.request();
    updates.cancel();
    await vi.advanceTimersByTimeAsync(80);
    expect(evaluate).toHaveBeenCalledTimes(2);
  });
});
