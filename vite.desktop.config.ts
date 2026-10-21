import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { parseStrudelSoundfontsWithoutEval } from "./vite.strudel-soundfonts";

// Static workbench assets are served by the Tauri webview.
export default defineConfig(({ command, mode }) => ({
  root: "desktop",
  cacheDir: fileURLToPath(
    new URL(`./node_modules/.vite-desktop/${command}-${mode}`, import.meta.url),
  ),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  envPrefix: "JAMSCRIPT_DESKTOP_PUBLIC_",
  resolve: {
    alias: [
      {
        find: "@/workbench/AuthControls",
        replacement: fileURLToPath(new URL("./desktop/AuthControls.tsx", import.meta.url)),
      },
      {
        find: "@/features/collaboration/ShareControls",
        replacement: fileURLToPath(new URL("./desktop/ShareControls.tsx", import.meta.url)),
      },
      {
        find: "@/engine/playback",
        replacement: fileURLToPath(new URL("./desktop/sandboxed-playback.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  plugins: [parseStrudelSoundfontsWithoutEval(), react(), tailwindcss()],
  server: { port: 1420, strictPort: true },
  build: {
    outDir: "../dist/desktop",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL("./desktop/index.html", import.meta.url)),
      },
    },
  },
}));
