/** Resolve app API paths. Desktop points at the deployed Worker; browser uses same-origin. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const desktopOrigin = String(import.meta.env["JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN"] ?? "").trim();
  if (desktopOrigin) return `${desktopOrigin.replace(/\/$/, "")}${normalized}`;
  return normalized;
}
