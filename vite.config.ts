import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { parseStrudelSoundfontsWithoutEval } from "./vite.strudel-soundfonts";

export default defineConfig(({ command, mode }) => ({
  // Web and desktop run concurrently with different aliases/dependencies.
  // Sharing the optimizer cache invalidates modules in the other dev server.
  cacheDir: `node_modules/.vite-web/${command}-${mode}`,
  resolve: {
    tsconfigPaths: true,
    // Use the published modular entry so the bundled runtime can be split and
    // shares the installed core/audio packages rather than nesting a second copy.
    alias: [{ find: /^@strudel\/web$/, replacement: "@strudel/web/web.mjs" }],
  },
  server: { watch: { ignored: ["**/src-tauri/target/**"] } },
  // Cloudflare emits server maps; Vite's CSS renderer needs the same setting
  // to map its asset URL replacements rather than invalidate that map chain.
  build: { sourcemap: true },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              includeDependenciesRecursively: false,
              groups: [
                { name: "assistant", test: /src[\\/]features[\\/]assistant[\\/]/ },
                {
                  name: "music-source",
                  test: /src[\\/]engine[\\/](?:music-document|mix-source|sample-insertion)\.ts$/,
                },
                {
                  name: "music-controls",
                  test: /src[\\/]components[\\/]ui[\\/](?:knob|level-meter|db-readout|db-scale|fader|pan-control|channel-strip|channel-toggle|mixer|bar-visualizer|smooth-waveform)\.tsx$|src[\\/]components[\\/]jam[\\/]inline-parameter\.tsx$|src[\\/]workbench[\\/](?:MixerPanel|TrackInspector|OutputPanel|CommandPalette|ExportControl)\.tsx$/,
                },
              ],
            },
          },
        },
      },
    },
  },
  plugins: [
    parseStrudelSoundfontsWithoutEval(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
}));
