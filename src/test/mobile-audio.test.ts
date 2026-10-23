import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Phone audio session", () => {
  it("asks for a playback session where the browser supports it", async () => {
    const audioSession = { type: "auto" };
    vi.stubGlobal("navigator", { ...navigator, audioSession });
    const { unlockMobileAudio } = await import("@/engine/mobile-audio");
    unlockMobileAudio();
    expect(audioSession.type).toBe("playback");
  });

  it("does nothing on desktops without an audio session API", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      platform: "Win32",
      maxTouchPoints: 0,
    });
    const create = vi.spyOn(document, "createElement");
    const { unlockMobileAudio } = await import("@/engine/mobile-audio");
    unlockMobileAudio();
    expect(create).not.toHaveBeenCalledWith("audio");
  });
});
