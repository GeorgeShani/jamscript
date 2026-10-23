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
    ssr: {
      build: {
        rolldownOptions: {
          output: {
            // Keep each Worker module under 500 kB. Splits follow whole packages: cutting a
            // package (or React) apart by size breaks its module wiring at startup.
            /* eslint-disable no-useless-escape -- path separators in module-id patterns */
            codeSplitting: {
              groups: [
                { name: "strudel-api", test: /strudel-api\.generated\.json/ },
                {
                  name: "react-dom-server",
                  test: /node_modules[\/]react-dom[\/](?:cjs[\/]react-dom-server|server)/,
                },
                { name: "react", test: /node_modules[\/](?:react|react-dom|scheduler)[\/]/ },
                { name: "codemirror-view", test: /node_modules[\/]@codemirror[\/]view[\/]/ },
                {
                  name: "codemirror-core",
                  test: /node_modules[\/](?:@codemirror[\/](?!view)|@lezer[\/]|style-mod|w3c-keyname|crelt|@marijn)/,
                },
                { name: "liveblocks", test: /node_modules[\/]@liveblocks[\/]core[\/]/ },
                {
                  name: "yjs",
                  test: /node_modules[\/](?:yjs|lib0|y-protocols|y-codemirror\.next)[\/]/,
                },
                {
                  name: "markdown-parse",
                  test: /node_modules[\/](?:micromark[^\/]*|decode-named-character-reference|character-entities[^\/]*|devlop)[\/]/,
                },
                {
                  name: "markdown-tree",
                  test: /node_modules[\/](?:react-markdown|remark-[^\/]+|mdast-util-[^\/]+|unified|hast-util-[^\/]+|unist-util-[^\/]+|vfile[^\/]*|property-information|html-url-attributes|trough|bail|is-plain-obj|space-separated-tokens|comma-separated-tokens|trim-lines|zwitch|ccount|escape-string-regexp|markdown-table|longest-streak|style-to-js|style-to-object|inline-style-parser|estree-util-is-identifier-name)[\/]/,
                },
              ],
            },
            /* eslint-enable no-useless-escape */
          },
        },
      },
    },
    client: {
      build: {
        // Browser source maps would be publicly downloadable (about 30 MB); server maps stay.
        sourcemap: false,
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
    {
      // The language service worker (6.5 MB with TypeScript) only runs in the browser; keep
      // it out of the Worker bundle.
      name: "jamscript-ssr-skip-language-client",
      enforce: "pre",
      resolveId(source) {
        if (this.environment?.name === "ssr" && source.endsWith("features/language/client"))
          return "\0jamscript-language-client-stub";
        return null;
      },
      load(id) {
        return id === "\0jamscript-language-client-stub"
          ? "export const attachStrudelLanguage = () => {};"
          : null;
      },
    },
    parseStrudelSoundfontsWithoutEval(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
}));
