import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SessionWorkbench } from "@/workbench/SessionWorkbench";
import { desktopStorage } from "./storage";
import "@/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("JamScript desktop root is missing");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider delayDuration={200}>
        <SessionWorkbench storage={desktopStorage} />
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
