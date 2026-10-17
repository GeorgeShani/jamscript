import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Static, app-only webview assets. A future Tauri target should use dist/desktop as frontendDist.
export default defineConfig({
  root: "desktop",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  envPrefix: "JAMSCRIPT_DESKTOP_PUBLIC_",
  resolve: {
    alias: [
      {
        find: "@/workbench/AuthControls",
        replacement: fileURLToPath(new URL("./desktop/AuthControls.tsx", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/desktop", emptyOutDir: true },
});
