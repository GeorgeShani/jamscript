import { useEffect, useState } from "react";
import { ArrowUpRight, Download, MonitorDown } from "lucide-react";
import {
  detectDesktopPlatform,
  isPublicRelease,
  RELEASE_API,
  RELEASES_PAGE,
  selectInstaller,
  type DesktopPlatform,
  type PublicRelease,
} from "./desktop-downloads";

const platforms: { id: DesktopPlatform; label: string; detail: string }[] = [
  { id: "windows", label: "Windows", detail: "Windows 10 or later" },
  { id: "macos", label: "macOS", detail: "Apple Silicon" },
  { id: "linux", label: "Linux", detail: "AppImage or DEB" },
];

export function DesktopDownloads() {
  const [platform, setPlatform] = useState<DesktopPlatform | null>(null);
  const [release, setRelease] = useState<PublicRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPlatform(detectDesktopPlatform(navigator.userAgent));
    const controller = new AbortController();
    fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        if (!controller.signal.aborted && isPublicRelease(value)) setRelease(value);
      })
      .catch(() => {
        // The browser workbench remains available if GitHub cannot be reached.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const recommended = platform ? selectInstaller(release, platform) : null;

  return (
    <section
      className="jam-site-section jam-site-downloads"
      id="download"
      aria-labelledby="download-title"
    >
      <div className="jam-site-downloads-heading" data-reveal>
        <p className="jam-site-kicker">JAMSCRIPT ON YOUR DESKTOP</p>
        <h2 id="download-title">Your music, closer to home.</h2>
        <p>
          The desktop edition opens local folders and saves directly to disk. Download JamScript for
          Windows, macOS or Linux, or open the browser workbench to start right away.
        </p>
      </div>
      <div className="jam-site-downloads-panel" data-reveal>
        <div className="jam-site-downloads-spotlight">
          <MonitorDown size={27} strokeWidth={1.7} aria-hidden="true" />
          <div>
            <span>DESKTOP EDITION</span>
            <strong>
              {platform
                ? `${platforms.find((item) => item.id === platform)?.label} detected`
                : "Windows · macOS · Linux"}
            </strong>
            <p aria-live="polite">
              {loading
                ? "Checking published installers…"
                : recommended
                  ? `${release?.tag_name} is ready for your platform.`
                  : "No public installer is available for your platform yet."}
            </p>
          </div>
          {recommended ? (
            <a className="jam-site-primary" href={recommended.browser_download_url}>
              <Download size={17} /> Download for{" "}
              {platforms.find((item) => item.id === platform)?.label}
            </a>
          ) : null}
        </div>
        <div className="jam-site-platforms" aria-label="Desktop platforms">
          {platforms.map((item) => {
            const asset = selectInstaller(release, item.id);
            return (
              <div className="jam-site-platform" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
                {asset ? (
                  <a
                    href={asset.browser_download_url}
                    aria-label={`Download JamScript for ${item.label}`}
                  >
                    Download <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <span className="jam-site-platform-unavailable">Coming soon</span>
                )}
              </div>
            );
          })}
        </div>
        <a
          className="jam-site-downloads-release-link"
          href={RELEASES_PAGE}
          target="_blank"
          rel="noreferrer"
        >
          {release ? "Release notes and all formats" : "View the release archive"}
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
