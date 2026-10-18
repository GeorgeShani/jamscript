import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Bundle the playback frame as one classic script. An opaque-origin sandbox
// cannot import ES modules from the parent Tauri origin.
export default defineConfig({
  root: "desktop",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "../dist/desktop-sandbox",
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("./desktop/sandbox.ts", import.meta.url)),
      name: "JamScriptAudioSandbox",
      formats: ["iife"],
      fileName: () => "sandbox.generated.js",
    },
  },
});
