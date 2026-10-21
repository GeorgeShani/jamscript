import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { DesktopAuthProvider } from "./auth";
import { DesktopApp } from "./DesktopApp";
import "@/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("JamScript desktop root is missing");

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
