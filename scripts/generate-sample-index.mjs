// Snapshots the default Strudel sample banks (name → file URLs) so Play never waits on
// GitHub to learn which sounds exist. The audio files themselves stay remote; the app
// refreshes this index from upstream in the background.
// node scripts/generate-sample-index.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = "https://raw.githubusercontent.com/felixroos/dough-samples/main";
const banks = ["tidal-drum-machines", "piano", "Dirt-Samples", "EmuSP12", "vcsl", "mridangam"];
const index = {};
for (const bank of banks) {
  const response = await fetch(`${base}/${bank}.json`);
  if (!response.ok) throw new Error(`${bank}: HTTP ${response.status}`);
  index[bank] = await response.json();
}
writeFileSync(
  fileURLToPath(new URL("../src/engine/sample-index.generated.json", import.meta.url)),
  `${JSON.stringify(index)}\n`,
);
console.log(`Wrote ${banks.length} banks`);
