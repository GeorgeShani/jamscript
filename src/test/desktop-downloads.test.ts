import { describe, expect, it } from "vitest";
import {
  detectDesktopPlatform,
  isPublicRelease,
  selectInstaller,
  type PublicRelease,
} from "@/marketing/desktop-downloads";

const release: PublicRelease = {
  tag_name: "v1.0.0",
  assets: [
    {
      name: "JamScript.msi",
      browser_download_url:
        "https://github.com/GeorgeShani/jamscript/releases/download/v1.0.0/JamScript.msi",
    },
    {
      name: "JamScript.dmg",
      browser_download_url:
        "https://github.com/GeorgeShani/jamscript/releases/download/v1.0.0/JamScript.dmg",
    },
    {
      name: "JamScript.AppImage",
      browser_download_url:
        "https://github.com/GeorgeShani/jamscript/releases/download/v1.0.0/JamScript.AppImage",
    },
  ],
};

describe("desktop release links", () => {
  it("detects a visitor platform without guessing for unknown agents", () => {
    expect(detectDesktopPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(detectDesktopPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macos");
    expect(detectDesktopPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(detectDesktopPlatform("curl/8")).toBeNull();
  });

  it("selects only actual published assets for the matching OS", () => {
    expect(selectInstaller(release, "windows")?.name).toBe("JamScript.msi");
    expect(selectInstaller(release, "macos")?.name).toBe("JamScript.dmg");
    expect(selectInstaller(release, "linux")?.name).toBe("JamScript.AppImage");
    expect(selectInstaller(null, "windows")).toBeNull();
  });

  it("rejects malformed or off-repository release links", () => {
    expect(isPublicRelease({ tag_name: "v1", assets: [] })).toBe(true);
    expect(isPublicRelease({ tag_name: "v1", assets: [{}] })).toBe(false);
    expect(
      selectInstaller(
        {
          tag_name: "v1",
          assets: [{ name: "JamScript.msi", browser_download_url: "https://example.com/file.msi" }],
        },
        "windows",
      ),
    ).toBeNull();
  });
});
