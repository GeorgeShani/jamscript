import { useEffect, useState } from "react";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import { desktopStorage } from "./storage";
import { useDesktopAuth } from "./auth-context";
import { SharedPage } from "./SharedPage";
import { OPEN_SHARED_DOCUMENT } from "./ShareControls";

export function DesktopApp() {
  const { person } = useDesktopAuth();
  const [sharedId, setSharedId] = useState<string | null>(null);
  useEffect(() => {
    const open = (event: Event) => setSharedId((event as CustomEvent<string>).detail);
    window.addEventListener(OPEN_SHARED_DOCUMENT, open);
    return () => window.removeEventListener(OPEN_SHARED_DOCUMENT, open);
  }, []);
  useEffect(() => {
    if (!person) setSharedId(null);
  }, [person]);
  return sharedId && person ? (
    <SharedPage documentId={sharedId} close={() => setSharedId(null)} />
  ) : (
    <SessionWorkbench storage={desktopStorage} collaboration />
  );
}
