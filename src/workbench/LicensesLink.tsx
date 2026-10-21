import type { MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

const WEB_LICENSES_PATH = "/licenses/THIRD_PARTY_NOTICES.txt";
const DESKTOP_LICENSES_URL = "https://jamscript.dev/licenses/THIRD_PARTY_NOTICES.txt";

export function LicensesLink() {
  const desktop = import.meta.env.MODE === "desktop";
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!desktop) return;
    event.preventDefault();
    void invoke("desktop_open_licenses").catch((cause: unknown) => {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    });
  };

  return (
    <a href={desktop ? DESKTOP_LICENSES_URL : WEB_LICENSES_PATH} onClick={open}>
      Licenses
    </a>
  );
}
