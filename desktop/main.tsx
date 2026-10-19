import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import { desktopStorage } from "./storage";
import { DesktopAuthProvider, useDesktopAuth } from "./auth";
import { SharedPage } from "./SharedPage";
import { OPEN_SHARED_DOCUMENT } from "./ShareControls";
import "@/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("JamScript desktop root is missing");

function DesktopApp() {
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

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider delayDuration={200}>
        <DesktopAuthProvider>
          <DesktopApp />
        </DesktopAuthProvider>
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
