import releaseConfig from "./desktop-release-config.json";

export type DesktopPlatform = "windows" | "macos" | "linux";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface PublicRelease {
  tag_name: string;
  assets: ReleaseAsset[];
}

export const RELEASE_API = releaseConfig.latestReleaseApi;
export const RELEASES_PAGE = releaseConfig.releasesPage;

export function detectDesktopPlatform(userAgent: string): DesktopPlatform | null {
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macos";
  if (/Linux|X11/i.test(userAgent)) return "linux";
  return null;
}

export function selectInstaller(
  release: PublicRelease | null,
  platform: DesktopPlatform,
): ReleaseAsset | null {
  if (!release || !Array.isArray(release.assets)) return null;
  const extension = {
    windows: /\.(msi|exe)$/i,
    macos: /\.dmg$/i,
    linux: /\.(AppImage|deb|rpm)$/i,
  }[platform];
  return (
    release.assets.find(
      (asset) =>
        extension.test(asset.name) &&
        asset.browser_download_url.startsWith(releaseConfig.assetBase),
    ) ?? null
  );
}

export function isPublicRelease(value: unknown): value is PublicRelease {
  if (!value || typeof value !== "object") return false;
  const release = value as Record<string, unknown>;
  return (
    typeof release["tag_name"] === "string" &&
    Array.isArray(release["assets"]) &&
    release["assets"].every(
      (asset) =>
        asset &&
        typeof asset === "object" &&
        typeof asset.name === "string" &&
        typeof asset.browser_download_url === "string",
    )
  );
}
